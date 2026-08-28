import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getLoggedInAdmin } from "@/lib/admin-auth";

export async function POST(req: Request) {
  try {
    const admin = await getLoggedInAdmin();
    if (!admin) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const {
      title,
      description,
      durationMinutes = 30,
      maxStrikes = 3,
      enableFullscreenLock = true,
      enableCameraProctor = true,
      enableTabSwitchDetect = true,
      supervisorPin = "123456",
      questions = [],
    } = body;

    if (!title || !Array.isArray(questions) || questions.length === 0) {
      return NextResponse.json(
        { success: false, error: "Judul kuis dan minimal 1 pertanyaan wajib ada." },
        { status: 400 }
      );
    }

    const newQuiz = await prisma.$transaction(async (tx) => {
      const createdQuiz = await tx.quiz.create({
        data: {
          title,
          description: description || "Ujian CBT Multi-Format VeloExambro",
          durationMinutes: Number(durationMinutes) || 30,
          maxStrikes: Number(maxStrikes) || 3,
          enableFullscreenLock: Boolean(enableFullscreenLock),
          enableCameraProctor: Boolean(enableCameraProctor),
          enableTabSwitchDetect: Boolean(enableTabSwitchDetect),
          supervisorPin: supervisorPin || "123456",
          shuffleQuestions: true,
          shuffleOptions: true,
        },
      });

      for (let idx = 0; idx < questions.length; idx++) {
        const q = questions[idx];
        const questionType = q.type || "SINGLE_CHOICE";

        await tx.question.create({
          data: {
            quizId: createdQuiz.id,
            type: questionType,
            text: q.text,
            points: Number(q.points) || 10,
            order: idx,
            sampleAnswer: q.sampleAnswer || null,
            gradingRubric: q.gradingRubric || null,
            caseSensitive: Boolean(q.caseSensitive),
            options: {
              create: (q.options || []).map((opt: any) => ({
                text: opt.text,
                isCorrect: Boolean(opt.isCorrect),
              })),
            },
          },
        });
      }

      return createdQuiz;
    });

    return NextResponse.json({
      success: true,
      message: `Kuis "${newQuiz.title}" berhasil diterbitkan ke VeloExambro CBT!`,
      data: {
        quizId: newQuiz.id,
        title: newQuiz.title,
      },
    });
  } catch (err: any) {
    console.error("[Create Multi Quiz API]", err);
    return NextResponse.json(
      { success: false, error: err.message || "Gagal membuat kuis multi-format." },
      { status: 500 }
    );
  }
}
