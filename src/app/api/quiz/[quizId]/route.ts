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
          include: {
            options: {
              select: {
                id: true,
                text: true,
                // Do not return isCorrect to the client!
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
        violations: {
          orderBy: { timestamp: "desc" },
          take: 10,
        },
      },
    });

    // Randomize questions/options if enabled and student is taking the quiz for the first time
    let formattedQuestions = [...quiz.questions];
    if (quiz.shuffleQuestions) {
      formattedQuestions = formattedQuestions.sort(() => Math.random() - 0.5);
    }

    if (quiz.shuffleOptions) {
      formattedQuestions = formattedQuestions.map((q) => ({
        ...q,
        options: [...q.options].sort(() => Math.random() - 0.5),
      }));
    }

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
              answers: attempt.answers ? JSON.parse(attempt.answers) : {},
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
