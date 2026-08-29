import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getLoggedInStudent } from "@/lib/student-auth";
import { getLoggedInAdmin } from "@/lib/admin-auth";
import { awardXP, evaluateBadges } from "@/lib/gamification";
import { evaluateStudentEssay } from "@/lib/ai-essay-evaluator";

export async function POST(req: Request) {
  try {
    const student = await getLoggedInStudent();
    const admin = !student ? await getLoggedInAdmin() : null;

    if (!student && !admin) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = await req.json();
    const { quizId, answers } = body;

    if (!quizId || (!Array.isArray(answers) && (typeof answers !== "object" || answers === null))) {
      return NextResponse.json(
        { success: false, error: "Invalid payload: quizId and answers are required." },
        { status: 400 }
      );
    }

    // Normalize answers format (supports both Array and Object/Dictionary maps)
    interface NormalizedUserAnswer {
      questionId: string;
      optionId?: string;
      selectedOptionIds?: string[];
      textResponse?: string;
    }

    let normalizedAnswers: NormalizedUserAnswer[] = [];

    if (Array.isArray(answers)) {
      normalizedAnswers = answers.map((a: any) => {
        if (typeof a === "object" && a !== null) {
          return {
            questionId: a.questionId,
            optionId: a.optionId,
            selectedOptionIds: a.selectedOptionIds,
            textResponse: a.textResponse,
          };
        }
        return a;
      });
    } else if (answers && typeof answers === "object") {
      normalizedAnswers = Object.entries(answers).map(([qId, val]: [string, any]) => {
        if (typeof val === "string") {
          return { questionId: qId, optionId: val, selectedOptionIds: [val] };
        } else if (typeof val === "object" && val !== null) {
          return {
            questionId: qId,
            optionId: val.optionId,
            selectedOptionIds: val.selectedOptionIds,
            textResponse: val.textResponse,
          };
        }
        return { questionId: qId };
      });
    }

    const quiz = await prisma.quiz.findUnique({
      where: { id: quizId },
      include: {
        questions: {
          include: {
            options: true,
          },
        },
      },
    });

    if (!quiz) {
      return NextResponse.json(
        { success: false, error: "Quiz not found" },
        { status: 404 }
      );
    }

    let totalScore = 0;
    let earnedScore = 0;
    let hasPendingEssays = false;

    // Process & Grade Each Question Answer
    const gradedDetails: Array<{
      questionId: string;
      selectedOptionIds?: string[];
      textResponse?: string | null;
      isAutoGraded: boolean;
      earnedPoints: number;
      aiSuggestedScore?: number;
      aiEvaluationFeedback?: string;
    }> = [];

    for (const q of quiz.questions) {
      totalScore += q.points;
      const userAns: NormalizedUserAnswer = normalizedAnswers.find((a) => a.questionId === q.id) || { questionId: q.id };
      const qType = q.type || "SINGLE_CHOICE";

      let pointsEarned = 0;
      let aiSuggestedScore: number | undefined = undefined;
      let aiFeedback: string | undefined = undefined;
      let isAutoGraded = true;

      if (qType === "SINGLE_CHOICE" || qType === "TRUE_FALSE") {
        const selectedId = userAns.optionId;
        const correctOpt = q.options.find((o) => o.isCorrect);
        if (selectedId && correctOpt && selectedId === correctOpt.id) {
          pointsEarned = q.points;
        }
      } else if (qType === "CHECKBOXES") {
        const selectedIds: string[] = Array.isArray(userAns.selectedOptionIds)
          ? userAns.selectedOptionIds
          : userAns.optionId
          ? [userAns.optionId]
          : [];

        const correctIds = q.options.filter((o) => o.isCorrect).map((o) => o.id);
        const wrongSelected = selectedIds.filter((id) => !correctIds.includes(id));
        const correctSelected = selectedIds.filter((id) => correctIds.includes(id));

        if (wrongSelected.length === 0 && correctSelected.length === correctIds.length) {
          // All correct, 0 wrong -> Full credit
          pointsEarned = q.points;
        } else if (wrongSelected.length === 0 && correctSelected.length > 0) {
          // Partial credit
          pointsEarned = Math.round((correctSelected.length / correctIds.length) * q.points * 10) / 10;
        }
      } else if (qType === "SHORT_ANSWER") {
        const textAns = (userAns.textResponse || "").trim();
        const expected = (q.sampleAnswer || q.options.find((o) => o.isCorrect)?.text || "").trim();
        const isMatch = q.caseSensitive
          ? textAns === expected
          : textAns.toLowerCase() === expected.toLowerCase();

        if (textAns && isMatch) {
          pointsEarned = q.points;
        }
      } else if (qType === "ESSAY") {
        const essayResponse = userAns.textResponse || "";
        hasPendingEssays = true;

        // Call AI Essay Evaluator for intelligent scoring suggestion
        const aiEvaluation = evaluateStudentEssay({
          questionText: q.text,
          sampleAnswer: q.sampleAnswer,
          gradingRubric: q.gradingRubric,
          studentResponse: essayResponse,
          maxPoints: q.points,
        });

        aiSuggestedScore = aiEvaluation.suggestedScore;
        aiFeedback = aiEvaluation.feedback;
        pointsEarned = aiEvaluation.suggestedScore; // initial AI suggested score
      }

      earnedScore += pointsEarned;

      gradedDetails.push({
        questionId: q.id,
        selectedOptionIds: userAns.selectedOptionIds || (userAns.optionId ? [userAns.optionId] : []),
        textResponse: userAns.textResponse || null,
        isAutoGraded,
        earnedPoints: pointsEarned,
        aiSuggestedScore,
        aiEvaluationFeedback: aiFeedback,
      });
    }

    // If Admin Preview Mode, return evaluated score without modifying database
    if (admin) {
      return NextResponse.json({
        success: true,
        data: {
          attemptId: "preview-attempt-id",
          score: earnedScore,
          totalScore,
          isFullyGraded: !hasPendingEssays,
          earnedXP: 0,
          newBadges: [],
          isPreview: true,
        },
      });
    }

    // Find existing attempt or create new
    let existingAttempt = await prisma.quizAttempt.findFirst({
      where: {
        quizId,
        userId: student!.id,
      },
      orderBy: { createdAt: "desc" },
    });

    let quizAttempt;
    if (existingAttempt) {
      quizAttempt = await prisma.quizAttempt.update({
        where: { id: existingAttempt.id },
        data: {
          score: earnedScore,
          totalScore,
          status: hasPendingEssays ? "SUBMITTED" : "GRADED",
          isFullyGraded: !hasPendingEssays,
          submittedAt: new Date(),
          answers: JSON.stringify(answers),
        },
      });
    } else {
      quizAttempt = await prisma.quizAttempt.create({
        data: {
          quizId,
          userId: student!.id,
          score: earnedScore,
          totalScore,
          status: hasPendingEssays ? "SUBMITTED" : "GRADED",
          isFullyGraded: !hasPendingEssays,
          startedAt: new Date(),
          submittedAt: new Date(),
          answers: JSON.stringify(answers),
        },
      });
    }

    // Save individual QuizStudentAnswer records
    for (const detail of gradedDetails) {
      await prisma.quizStudentAnswer.upsert({
        where: {
          attemptId_questionId: {
            attemptId: quizAttempt.id,
            questionId: detail.questionId,
          },
        },
        update: {
          selectedOptionIds: detail.selectedOptionIds ? JSON.stringify(detail.selectedOptionIds) : null,
          textResponse: detail.textResponse || null,
          isAutoGraded: detail.isAutoGraded,
          earnedPoints: detail.earnedPoints,
          aiSuggestedScore: detail.aiSuggestedScore,
          aiEvaluationFeedback: detail.aiEvaluationFeedback,
        },
        create: {
          attemptId: quizAttempt.id,
          questionId: detail.questionId,
          selectedOptionIds: detail.selectedOptionIds ? JSON.stringify(detail.selectedOptionIds) : null,
          textResponse: detail.textResponse || null,
          isAutoGraded: detail.isAutoGraded,
          earnedPoints: detail.earnedPoints,
          aiSuggestedScore: detail.aiSuggestedScore,
          aiEvaluationFeedback: detail.aiEvaluationFeedback,
        },
      });
    }

    try {
      await awardXP(student!.id, 50, "Menyelesaikan Ujian CBT");
      await evaluateBadges(student!.id);
    } catch (xpErr) {
      console.error("[Quiz API POST] Error awarding XP:", xpErr);
    }

    return NextResponse.json({
      success: true,
      message: "Ujian berhasil dikumpulkan dan dinilai!",
      data: {
        ...quizAttempt,
        hasPendingEssays,
      },
    });
  } catch (err) {
    console.error("[Quiz API POST Submit]", err);
    return NextResponse.json(
      { success: false, error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
