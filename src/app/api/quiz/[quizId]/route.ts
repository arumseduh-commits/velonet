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
                isCorrect: true, // we will sanitize per student/admin below
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

    const isScoreVisible =
      Boolean(admin) ||
      quiz.showScoreImmediately ||
      (quiz.scoreReleaseAt && new Date() >= new Date(quiz.scoreReleaseAt));

    const isDiscussionVisible =
      Boolean(admin) ||
      (Boolean(quiz.showDiscussion) && isScoreVisible && attempt && (attempt.status === "SUBMITTED" || attempt.status === "GRADED"));

    // Structure questions for student player / admin preview
    const formattedQuestions = quiz.questions.map((q) => {
      // Find student answer for this question
      const studentAnsRecord = attempt?.detailedAnswers?.find((da: any) => da.questionId === q.id);

      // Check if student answer is correct
      let studentIsCorrect: boolean | undefined = undefined;
      let selectedOptionId: string | null = null;
      let selectedOptionIds: string[] | null = null;

      if (studentAnsRecord) {
        if (studentAnsRecord.selectedOptionIds) {
          try {
            selectedOptionIds = JSON.parse(studentAnsRecord.selectedOptionIds);
          } catch (e) {}
        }
        if (selectedOptionIds && selectedOptionIds.length === 1) {
          selectedOptionId = selectedOptionIds[0];
        }

        if (q.type === "SINGLE_CHOICE" || q.type === "TRUE_FALSE") {
          const correctOpt = q.options.find((o) => o.isCorrect);
          if (correctOpt && selectedOptionId) {
            studentIsCorrect = correctOpt.id === selectedOptionId;
          }
        }
      }

      return {
        id: q.id,
        type: q.type,
        text: q.text,
        imageUrl: q.imageUrl || null,
        points: q.points,
        options: q.options.map((opt) => ({
          id: opt.id,
          text: opt.text,
          isCorrect: Boolean(admin) || isDiscussionVisible ? opt.isCorrect : undefined,
        })),
        sampleAnswer: Boolean(admin) || isDiscussionVisible ? q.sampleAnswer : null,
        gradingRubric: Boolean(admin) || isDiscussionVisible ? q.gradingRubric : null,
        explanation: Boolean(admin) || isDiscussionVisible ? q.explanation : null,
        studentAnswer: isDiscussionVisible && studentAnsRecord
          ? {
              optionId: selectedOptionId,
              selectedOptionIds,
              textResponse: studentAnsRecord.textResponse,
              isCorrect: studentIsCorrect,
              earnedPoints: studentAnsRecord.earnedPoints,
            }
          : undefined,
      };
    });

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
      examToken: admin ? quiz.examToken : undefined,
      showScoreImmediately: quiz.showScoreImmediately ?? true,
      scoreReleaseAt: quiz.scoreReleaseAt ? quiz.scoreReleaseAt.toISOString() : null,
      showDiscussion: quiz.showDiscussion ?? false,
      isScoreVisible,
      isDiscussionVisible,
      questions: formattedQuestions,
    };

    return NextResponse.json({
      success: true,
      data: {
        quiz: sanitizedQuiz,
        isPreview: Boolean(admin),
        isScoreVisible,
        isDiscussionVisible,
        attempt: attempt
          ? {
              id: attempt.id,
              status: attempt.status,
              strikeCount: attempt.strikeCount,
              startedAt: attempt.startedAt,
              submittedAt: attempt.submittedAt,
              score: isScoreVisible ? attempt.score : null,
              totalScore: attempt.totalScore,
              isFullyGraded: attempt.isFullyGraded,
              scoreReleased: isScoreVisible,
              scoreReleaseAt: quiz.scoreReleaseAt ? quiz.scoreReleaseAt.toISOString() : null,
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
