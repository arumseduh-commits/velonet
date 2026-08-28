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

    // Create Quiz with Questions and Options in a Prisma Transaction
    const newQuiz = await prisma.$transaction(async (tx) => {
      const createdQuiz = await tx.quiz.create({
        data: {
          title,
          description: description || "Ujian CBT VeloExambro",
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

      for (const q of questions) {
        await tx.question.create({
          data: {
            quizId: createdQuiz.id,
            text: q.text,
            points: Number(q.points) || 10,
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
      message: `Kuis "${newQuiz.title}" berhasil disimpan dan siap diujikan di VeloExambro!`,
      data: {
        quizId: newQuiz.id,
        title: newQuiz.title,
      },
    });
  } catch (err: any) {
    console.error("[AI Save Quiz API]", err);
    return NextResponse.json(
      { success: false, error: err.message || "Gagal menyimpan kuis." },
      { status: 500 }
    );
  }
}
