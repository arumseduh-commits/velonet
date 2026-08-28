import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getLoggedInStudent } from "@/lib/student-auth";

export async function GET(
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
        questions: {
          orderBy: { order: "asc" },
          include: {
            options: {
              select: {
                id: true,
                text: true,
                // Do not return isCorrect to student!
              },
            },
          },
        },
      },
    });

    if (!quiz) {
      return NextResponse.json({ success: false, error: "Quiz not found" }, { status: 404 });
    }

    // Check existing attempt for this student
    const attempt = await prisma.quizAttempt.findUnique({
      where: {
        quizId_userId: {
          quizId,
          userId: student.id,
        },
      },
      include: {
        detailedAnswers: true,
        violations: {
          orderBy: { timestamp: "desc" },
          take: 10,
        },
      },
    });

    // Structure questions for student player
    const formattedQuestions = quiz.questions.map((q) => ({
      id: q.id,
      type: q.type,
      text: q.text,
      points: q.points,
      options: q.options,
    }));

    const sanitizedQuiz = {
      id: quiz.id,
      title: quiz.title,
      description: quiz.description,
      durationMinutes: quiz.durationMinutes || 30,
      enableFullscreenLock: quiz.enableFullscreenLock ?? true,
      enableTabSwitchDetect: quiz.enableTabSwitchDetect ?? true,
      maxStrikes: quiz.maxStrikes || 3,
      enableCameraProctor: quiz.enableCameraProctor ?? true,
      questions: formattedQuestions,
    };

    return NextResponse.json({
      success: true,
      data: {
        quiz: sanitizedQuiz,
        attempt: attempt
          ? {
              id: attempt.id,
              status: attempt.status,
              strikeCount: attempt.strikeCount,
              startedAt: attempt.startedAt,
              submittedAt: attempt.submittedAt,
              score: attempt.score,
              totalScore: attempt.totalScore,
              isFullyGraded: attempt.isFullyGraded,
              answers: attempt.answers ? JSON.parse(attempt.answers) : {},
              detailedAnswers: attempt.detailedAnswers,
              violations: attempt.violations,
            }
          : null,
      },
    });
  } catch (err) {
    console.error("[Quiz API GET]", err);
    return NextResponse.json({ success: false, error: "Internal Server Error" }, { status: 500 });
  }
}
