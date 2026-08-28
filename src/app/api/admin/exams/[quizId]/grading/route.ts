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
          where: { type: "ESSAY" },
          orderBy: { order: "asc" },
        },
      },
    });

    if (!quiz) {
      return NextResponse.json({ success: false, error: "Kuis tidak ditemukan." }, { status: 404 });
    }

    const attempts = await prisma.quizAttempt.findMany({
      where: { quizId },
      include: {
        user: {
          select: { id: true, name: true, phoneNumber: true, studentClass: true },
        },
        detailedAnswers: {
          include: {
            question: true,
          },
        },
      },
      orderBy: { submittedAt: "desc" },
    });

    return NextResponse.json({
      success: true,
      data: {
        quizTitle: quiz.title,
        essayQuestions: quiz.questions,
        attempts: attempts.map((att) => ({
          id: att.id,
          userId: att.userId,
          userName: att.user?.name || "Peserta",
          studentClass: att.user?.studentClass || "-",
          status: att.status,
          score: att.score,
          totalScore: att.totalScore,
          isFullyGraded: att.isFullyGraded,
          submittedAt: att.submittedAt,
          answers: att.detailedAnswers,
        })),
      },
    });
  } catch (err: any) {
    console.error("[Grading API GET]", err);
    return NextResponse.json({ success: false, error: "Internal Server Error" }, { status: 500 });
  }
}
