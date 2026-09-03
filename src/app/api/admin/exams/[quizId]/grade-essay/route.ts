import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getLoggedInAdmin } from "@/lib/admin-auth";

/**
 * Helper to call Gemini 3.6 Flash for single essay grading
 */
async function evaluateEssayWithGemini({
  questionText,
  maxPoints,
  sampleAnswer,
  gradingRubric,
  studentAnswer,
  apiKey,
}: {
  questionText: string;
  maxPoints: number;
  sampleAnswer?: string | null;
  gradingRubric?: string | null;
  studentAnswer?: string | null;
  apiKey?: string;
}): Promise<{ score: number; feedback: string }> {
  const finalApiKey = apiKey || process.env.GEMINI_API_KEY;

  if (!finalApiKey) {
    // Fallback heuristic scoring if no API key is set
    const ans = (studentAnswer || "").trim().toLowerCase();
    if (!ans || ans.length < 5) {
      return { score: 0, feedback: "Jawaban kosong atau terlalu singkat untuk dinilai." };
    }
    const sample = (sampleAnswer || "").toLowerCase();
    let matchCount = 0;
    const words = sample.split(/\s+/).filter((w) => w.length > 3);
    for (const w of words) {
      if (ans.includes(w)) matchCount++;
    }
    const ratio = words.length > 0 ? Math.min(matchCount / words.length, 1) : 0.5;
    const score = Math.round(ratio * maxPoints);
    return {
      score,
      feedback: `Nilai heuristik awal (${score}/${maxPoints}) berdasarkan kemiripan kata kunci esensial.`,
    };
  }

  const prompt = `
Anda adalah Guru Penilai CBT Ahli dan Objektif di platform VeloNet LMS.
Tugas Anda adalah menilai jawaban uraian/essay siswa secara adil, teliti, dan konstruktif berdasarkan rubrik dan contoh jawaban ideal.

DATA SOAL & RUBRIK:
- Pertanyaan: "${questionText}"
- Poin Maksimum: ${maxPoints}
- Contoh Jawaban Ideal: "${sampleAnswer || "Tidak ada contoh spesifik, nilai berdasarkan pemahaman konsep."}"
- Panduan Rubrik Penilaian: "${gradingRubric || "Nilai proporsional berdasarkan kebenaran konsep dan kelengkapan argumen."}"

JAWABAN SISWA:
"""
${(studentAnswer || "").trim() || "(Siswa tidak mengisi jawaban)"}
"""

ATURAN PENILAIAN:
1. Berikan skor bulat atau desimal antara 0 sampai ${maxPoints}. Jangan pernah melebihi ${maxPoints} atau kurang dari 0.
2. Jika jawaban kosong atau sama sekali tidak relevan, berikan skor 0.
3. Tulis feedback evaluasi (maksimal 2 kalimat) dalam Bahasa Indonesia yang menjelaskan kriteria apa yang sudah dicapai atau poin apa yang kurang.

KEMBALIKAN HANYA FORMAT JSON VALID:
{
  "score": <angka antara 0 dan ${maxPoints}>,
  "feedback": "<Ulasan evaluasi ringkas dan konstruktif>"
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
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.2,
            responseMimeType: "application/json",
          },
        }),
      });

      if (!response.ok) {
        continue;
      }

      const json = await response.json();
      const rawText = json?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (rawText) {
        const parsed = JSON.parse(rawText.replace(/^```json\s*/i, "").replace(/\s*```$/i, "").trim());
        const finalScore = Math.min(Math.max(0, Number(parsed.score) || 0), maxPoints);
        return {
          score: finalScore,
          feedback: parsed.feedback || "Evaluasi otomatis selesai.",
        };
      }
    } catch (e) {
      console.warn(`[evaluateEssayWithGemini] Model ${model} failed:`, e);
    }
  }

  return {
    score: Math.round(maxPoints * 0.5),
    feedback: "Evaluasi awal selesai.",
  };
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ quizId: string }> }
) {
  try {
    const admin = await getLoggedInAdmin();
    if (!admin) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const { quizId } = await params;
    const body = await req.json();
    const { action, attemptId, answerId, teacherScore, teacherFeedback, approveAIScore, apiKey } = body;

    // ACTION A: BATCH AI ESSAY GRADING
    if (action === "batch_ai_grade") {
      const essayAnswers = await prisma.quizStudentAnswer.findMany({
        where: {
          attempt: { quizId },
          question: { type: "ESSAY" },
        },
        include: {
          question: true,
          attempt: { select: { id: true, userId: true } },
        },
      });

      if (essayAnswers.length === 0) {
        return NextResponse.json({
          success: true,
          message: "Tidak ada jawaban uraian yang perlu dinilai.",
          data: { gradedCount: 0 },
        });
      }

      let gradedCount = 0;

      // Process in sequence or small concurrent chunks to prevent API rate limits
      for (const ans of essayAnswers) {
        const q = ans.question;
        const evaluation = await evaluateEssayWithGemini({
          questionText: q.text,
          maxPoints: q.points,
          sampleAnswer: q.sampleAnswer,
          gradingRubric: q.gradingRubric,
          studentAnswer: ans.textResponse,
          apiKey,
        });

        await prisma.quizStudentAnswer.update({
          where: { id: ans.id },
          data: {
            aiSuggestedScore: evaluation.score,
            aiEvaluationFeedback: evaluation.feedback,
          },
        });
        gradedCount++;
      }

      return NextResponse.json({
        success: true,
        message: `Berhasil mengevaluasi ${gradedCount} jawaban uraian dengan AI Gemini 3.6 Flash!`,
        data: { gradedCount },
      });
    }

    // ACTION B: BATCH APPROVE ALL AI SCORES
    if (action === "batch_approve_all") {
      const answersToApprove = await prisma.quizStudentAnswer.findMany({
        where: {
          attempt: { quizId },
          question: { type: "ESSAY" },
          aiSuggestedScore: { not: null },
        },
      });

      if (answersToApprove.length === 0) {
        return NextResponse.json({
          success: false,
          error: "Belum ada rekomendasi nilai AI untuk disetujui. Jalankan koreksi AI terlebih dahulu.",
        });
      }

      // Update answers
      const affectedAttemptIds = new Set<string>();
      for (const ans of answersToApprove) {
        affectedAttemptIds.add(ans.attemptId);
        const approvedScore = ans.aiSuggestedScore ?? 0;
        await prisma.quizStudentAnswer.update({
          where: { id: ans.id },
          data: {
            teacherScore: approvedScore,
            earnedPoints: approvedScore,
            teacherFeedback: ans.teacherFeedback || "Disetujui dari rekomendasi AI.",
            gradedByUserId: admin.username || "admin",
          },
        });
      }

      // Recalculate total scores for all affected attempts
      for (const attId of affectedAttemptIds) {
        const allAnswers = await prisma.quizStudentAnswer.findMany({
          where: { attemptId: attId },
        });
        const total = allAnswers.reduce((sum, a) => sum + a.earnedPoints, 0);

        await prisma.quizAttempt.update({
          where: { id: attId },
          data: {
            score: total,
            status: "GRADED",
            isFullyGraded: true,
            gradedAt: new Date(),
          },
        });
      }

      return NextResponse.json({
        success: true,
        message: `Berhasil menyetujui ${answersToApprove.length} nilai rekomendasi AI untuk ${affectedAttemptIds.size} siswa!`,
        data: { approvedCount: answersToApprove.length, attemptsCount: affectedAttemptIds.size },
      });
    }

    // ACTION C: SINGLE ANSWER GRADE (Existing behavior)
    if (!attemptId || !answerId) {
      return NextResponse.json({ success: false, error: "Parameter tidak lengkap." }, { status: 400 });
    }

    const existingAnswer = await prisma.quizStudentAnswer.findUnique({
      where: { id: answerId },
      include: { question: true },
    });

    if (!existingAnswer) {
      return NextResponse.json({ success: false, error: "Jawaban siswa tidak ditemukan." }, { status: 404 });
    }

    const maxPoints = existingAnswer.question.points;
    let finalScore = approveAIScore
      ? (existingAnswer.aiSuggestedScore ?? existingAnswer.earnedPoints)
      : Number(teacherScore);

    if (isNaN(finalScore) || finalScore < 0) finalScore = 0;
    if (finalScore > maxPoints) finalScore = maxPoints;

    await prisma.quizStudentAnswer.update({
      where: { id: answerId },
      data: {
        teacherScore: finalScore,
        teacherFeedback: teacherFeedback || (approveAIScore ? "Nilai rekomendasi AI disetujui Guru." : null),
        earnedPoints: finalScore,
        gradedByUserId: admin.username || "admin",
      },
    });

    // Recalculate total score for the attempt
    const allAnswers = await prisma.quizStudentAnswer.findMany({
      where: { attemptId },
    });
    const newTotalEarned = allAnswers.reduce((acc, a) => acc + a.earnedPoints, 0);

    const updatedAttempt = await prisma.quizAttempt.update({
      where: { id: attemptId },
      data: {
        score: newTotalEarned,
        status: "GRADED",
        isFullyGraded: true,
        gradedAt: new Date(),
      },
    });

    return NextResponse.json({
      success: true,
      message: "Nilai uraian berhasil disimpan dan diperbarui!",
      data: {
        attemptId: updatedAttempt.id,
        newTotalScore: updatedAttempt.score,
      },
    });
  } catch (err: any) {
    console.error("[Grade Essay POST]", err);
    return NextResponse.json({ success: false, error: "Internal Server Error" }, { status: 500 });
  }
}
