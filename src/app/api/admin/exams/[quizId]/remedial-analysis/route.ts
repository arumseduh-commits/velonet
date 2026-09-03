import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getLoggedInAdmin } from "@/lib/admin-auth";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ quizId: string }> }
) {
  try {
    const admin = await getLoggedInAdmin();
    if (!admin) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const { quizId } = await params;

    const quiz = await prisma.quiz.findUnique({
      where: { id: quizId },
      include: {
        questions: {
          include: { options: true },
        },
      },
    });

    if (!quiz) {
      return NextResponse.json({ success: false, error: "Kuis tidak ditemukan." }, { status: 404 });
    }

    // Fetch attempts
    const attempts = await prisma.quizAttempt.findMany({
      where: { quizId, status: { in: ["SUBMITTED", "GRADED"] } },
      include: {
        detailedAnswers: true,
      },
    });

    const totalAttempts = attempts.length;
    if (totalAttempts === 0) {
      return NextResponse.json({
        success: true,
        data: {
          totalAttempts: 0,
          averageScore: 0,
          questionStats: [],
          analysisSummary: "Belum ada data pengerjaan siswa pada kuis ini.",
          weakTopics: [],
          remedialQuizDraft: null,
        },
      });
    }

    const totalScoreSum = attempts.reduce((acc, a) => acc + a.score, 0);
    const averageScore = Math.round((totalScoreSum / totalAttempts) * 10) / 10;

    // Calculate error rates per question
    const questionStats = quiz.questions.map((q, idx) => {
      let totalAnswered = 0;
      let wrongCount = 0;

      attempts.forEach((att) => {
        const ans = att.detailedAnswers?.find((a: any) => a.questionId === q.id);
        if (ans) {
          totalAnswered++;
          if (ans.earnedPoints === 0 && q.points > 0) {
            wrongCount++;
          }
        }
      });

      const errorRate = totalAnswered > 0 ? Math.round((wrongCount / totalAnswered) * 100) : 0;

      return {
        questionNumber: idx + 1,
        questionId: q.id,
        text: q.text,
        type: q.type,
        points: q.points,
        bloomLevel: idx % 2 === 0 ? "C2" : "C3",
        totalAnswered,
        wrongCount,
        errorRate,
      };
    });

    // Sort by highest error rate
    const sortedByFailure = [...questionStats].sort((a, b) => b.errorRate - a.errorRate);
    const failedQuestions = sortedByFailure.filter((q) => q.errorRate >= 25).slice(0, 5);

    // Call Gemini 3.6 Flash for cognitive diagnostic & remedial quiz synthesis
    const finalApiKey = process.env.GEMINI_API_KEY;
    let analysisSummary = `Rata-rata kelas: ${averageScore}. Sebanyak ${failedQuestions.length} soal memiliki tingkat kesalahan di atas 25%.`;
    let weakTopics: string[] = [];
    let remedialQuizDraft: any = null;

    if (finalApiKey && failedQuestions.length > 0) {
      try {
        const failedContext = failedQuestions
          .map(
            (q) =>
              `• Soal #${q.questionNumber} [Tipe: ${q.type}, Bloom: ${q.bloomLevel}, Error Rate: ${q.errorRate}%]: "${q.text}"`
          )
          .join("\n");

        const prompt = `
Anda adalah Analis Evaluasi Kognitif Belajar dan Kurikulum di platform VeloNet LMS.
Berdasarkan data statistik kuis "${quiz.title}" (Rata-rata kelas: ${averageScore} dari total ${totalAttempts} siswa):

SOAL-SOAL DENGAN TINGKAT KEGAGALAN TERTINGGI:
${failedContext}

TUGAS ANDA:
1. Buat "analysisSummary": Rangkuman mendalam (2-3 paragraf) dalam Bahasa Indonesia mengapa siswa gagal pada soal-soal tersebut dan apa miskonsepsi kognitif utamanya.
2. Buat "weakTopics": Daftar 2-4 nama topik/konsep kunci yang belum dikuasai siswa.
3. Buat "remedialQuizDraft": Draf kuis CBT remedial (4-5 butir soal multi-format) dengan tingkat kesulitan bertahap (Taksonomi Bloom C1 s.d. C4) yang dirancang khusus untuk memulihkan pemahaman siswa pada konsep yang salah tersebut.

FORMAT JSON OUTPUT WAJIB (tanpa markdown pembungkus):
{
  "analysisSummary": "...",
  "weakTopics": ["Topik A", "Topik B"],
  "remedialQuizDraft": {
    "title": "Kuis Remedial: Pemantapan ${quiz.title.slice(0, 30)}",
    "description": "Kuis latihan remedial yang dirancang khusus oleh AI untuk memperkuat pemahaman pada materi yang paling banyak salah.",
    "category": "Remedial CBT",
    "durationMinutes": 20,
    "maxStrikes": 3,
    "enableFullscreenLock": true,
    "enableCameraProctor": false,
    "enableTabSwitchDetect": true,
    "supervisorPin": "${Math.floor(100000 + Math.random() * 900000)}",
    "questions": [
      {
        "type": "SINGLE_CHOICE",
        "text": "Pertanyaan konsep penguatan...",
        "points": 10,
        "bloomLevel": "C2",
        "explanation": "Penjelasan kunci...",
        "options": [
          { "text": "Opsi A", "isCorrect": true },
          { "text": "Opsi B", "isCorrect": false }
        ]
      },
      {
        "type": "CHECKBOXES",
        "text": "Pilihlah semua yang benar terkait...",
        "points": 15,
        "bloomLevel": "C3",
        "options": [
          { "text": "Opsi A", "isCorrect": true },
          { "text": "Opsi B", "isCorrect": true },
          { "text": "Opsi C", "isCorrect": false }
        ]
      },
      {
        "type": "TRUE_FALSE",
        "text": "Pernyataan...",
        "points": 10,
        "bloomLevel": "C2",
        "options": [
          { "text": "BENAR", "isCorrect": true },
          { "text": "SALAH", "isCorrect": false }
        ]
      },
      {
        "type": "SHORT_ANSWER",
        "text": "Sebutkan...",
        "points": 10,
        "bloomLevel": "C1",
        "sampleAnswer": "Kunci",
        "gradingRubric": "Ketepatan istilah"
      }
    ]
  }
}
`.trim();

        const candidateModels = [
          "gemini-3.5-flash",
          "gemini-3.5-flash-lite",
          "gemini-flash-lite-latest",
          "gemini-3.6-flash",
          "gemini-flash-latest",
        ];
        for (const model of candidateModels) {
          try {
            const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${finalApiKey}`;
            const res = await fetch(url, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                contents: [{ role: "user", parts: [{ text: prompt }] }],
                generationConfig: {
                  temperature: 0.3,
                  responseMimeType: "application/json",
                },
              }),
            });

            if (!res.ok) continue;
            const data = await res.json();
            const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
            if (rawText) {
              const parsed = JSON.parse(rawText.replace(/^```json\s*/i, "").replace(/\s*```$/i, "").trim());
              analysisSummary = parsed.analysisSummary || analysisSummary;
              weakTopics = parsed.weakTopics || [];
              remedialQuizDraft = parsed.remedialQuizDraft || null;
              break;
            }
          } catch (e) {
            console.warn(`[remedial-analysis] Attempt ${model} failed:`, e);
          }
        }
      } catch (err) {
        console.error("[remedial-analysis] AI synthesis error:", err);
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        totalAttempts,
        averageScore,
        questionStats: sortedByFailure,
        failedQuestions,
        analysisSummary,
        weakTopics,
        remedialQuizDraft,
      },
    });
  } catch (err: any) {
    console.error("[Remedial Analysis GET]", err);
    return NextResponse.json({ success: false, error: "Internal Server Error" }, { status: 500 });
  }
}
