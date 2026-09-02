import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getLoggedInAdmin } from "@/lib/admin-auth";
import { MultiFormatQuestionDraft } from "@/lib/gemini-copilot";

export async function POST(req: Request) {
  try {
    const admin = await getLoggedInAdmin();
    if (!admin) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { action, quizId, questions } = body;

    // Action 1: Add Questions to an Existing Quiz
    if (action === "add_questions_to_quiz") {
      if (!quizId || !Array.isArray(questions) || questions.length === 0) {
        return NextResponse.json(
          { success: false, error: "Parameter quizId atau questions tidak valid." },
          { status: 400 }
        );
      }

      const quiz = await prisma.quiz.findUnique({
        where: { id: quizId },
        include: { questions: { select: { order: true } } },
      });

      if (!quiz) {
        return NextResponse.json({ success: false, error: "Kuis tidak ditemukan." }, { status: 404 });
      }

      let currentMaxOrder = quiz.questions.reduce((max, q) => Math.max(max, q.order), 0);

      await prisma.$transaction(async (tx) => {
        for (const q of questions as MultiFormatQuestionDraft[]) {
          currentMaxOrder += 1;
          await tx.question.create({
            data: {
              quizId,
              type: q.type,
              text: q.text,
              points: q.points || 10,
              order: currentMaxOrder,
              sampleAnswer: q.sampleAnswer,
              gradingRubric: q.gradingRubric,
              options:
                q.options && q.options.length > 0
                  ? {
                      create: q.options.map((opt) => ({
                        text: opt.text,
                        isCorrect: opt.isCorrect,
                      })),
                    }
                  : undefined,
            },
          });
        }
      });

      return NextResponse.json({
        success: true,
        message: `Berhasil menambahkan ${questions.length} soal ke kuis "${quiz.title}"!`,
      });
    }

    // Action 2: Get Quick Admin Stats
    if (action === "get_quick_stats") {
      const [users, quizzes, sessions, strikes] = await Promise.all([
        prisma.user.count(),
        prisma.quiz.count(),
        prisma.meetingSession.count(),
        prisma.examViolationLog.count().catch(() => 0),
      ]);

      return NextResponse.json({
        success: true,
        data: {
          users,
          quizzes,
          sessions,
          strikes,
        },
      });
    }

    return NextResponse.json({ success: false, error: "Aksi tidak dikenal." }, { status: 400 });
  } catch (err: any) {
    console.error("[AI Action POST]", err);
    return NextResponse.json({ success: false, error: err.message || "Internal Server Error" }, { status: 500 });
  }
}
