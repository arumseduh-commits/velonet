import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getLoggedInStudent } from "@/lib/student-auth";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ quizId: string }> }
) {
  try {
    const student = await getLoggedInStudent();
    if (!student) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const { quizId } = await params;

    const quiz = await prisma.quiz.findUnique({
      where: { id: quizId },
      include: {
        questions: true,
      },
    });

    if (!quiz) {
      return NextResponse.json({ success: false, error: "Kuis tidak ditemukan." }, { status: 404 });
    }

    // Find or create attempt
    let attempt = await prisma.quizAttempt.findUnique({
      where: {
        quizId_userId: {
          quizId,
          userId: student.id,
        },
      },
    });

    if (!attempt) {
      const totalPossibleScore = quiz.questions.reduce((acc, q) => acc + q.points, 0);

      attempt = await prisma.quizAttempt.create({
        data: {
          quizId,
          userId: student.id,
          status: "IN_PROGRESS",
          strikeCount: 0,
          score: 0,
          totalScore: totalPossibleScore,
          startedAt: new Date(),
        },
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        attemptId: attempt.id,
        status: attempt.status,
        strikeCount: attempt.strikeCount,
        startedAt: attempt.startedAt,
      },
    });
  } catch (err) {
    console.error("[Quiz API START]", err);
    return NextResponse.json({ success: false, error: "Internal Server Error" }, { status: 500 });
  }
}
