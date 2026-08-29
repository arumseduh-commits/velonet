import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getLoggedInStudent } from "@/lib/student-auth";
import { getLoggedInAdmin } from "@/lib/admin-auth";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ quizId: string }> }
) {
  try {
    const student = await getLoggedInStudent();
    const admin = !student ? await getLoggedInAdmin() : null;

    if (!student && !admin) {
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
                isCorrect: Boolean(admin), // Only expose isCorrect to admin preview!
              },
            },
          },
        },
      },
    });

    if (!quiz) {
      return NextResponse.json({ success: false, error: "Quiz not found" }, { status: 404 });
    }

    // Check existing attempt for this student (if student logged in)
    let attempt: any = null;
    if (student) {
      attempt = await prisma.quizAttempt.findFirst({
        where: {
          quizId,
          userId: student.id,
        },
        orderBy: { createdAt: "desc" },
        include: {
          detailedAnswers: true,
          violations: {
            orderBy: { timestamp: "desc" },
            take: 10,
          },
        },
      });
    }

    // Structure questions for student player / admin preview
    const formattedQuestions = quiz.questions.map((q) => ({
      id: q.id,
      type: q.type,
      text: q.text,
      imageUrl: q.imageUrl || null,
      points: q.points,
      options: q.options,
      sampleAnswer: admin ? q.sampleAnswer : null,
      gradingRubric: admin ? q.gradingRubric : null,
    }));

    const sanitizedQuiz = {
      id: quiz.id,
      title: quiz.title,
      description: quiz.description,
      durationMinutes: quiz.durationMinutes || 30,
      enableFullscreenLock: quiz.enableFullscreenLock ?? true,
      enableTabSwitchDetect: quiz.enableTabSwitchDetect ?? true,
      maxStrikes: quiz.maxStrikes || 3,
      enableCameraProctor: quiz.enableCameraProctor ?? false,
      hasExamToken: Boolean(quiz.examToken),
      examToken: admin ? quiz.examToken : undefined, // Only admin can see the actual token
      showScoreImmediately: quiz.showScoreImmediately ?? true,
      showDiscussion: quiz.showDiscussion ?? false,
      questions: formattedQuestions,
    };

    return NextResponse.json({
      success: true,
      data: {
        quiz: sanitizedQuiz,
        isPreview: Boolean(admin),
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
