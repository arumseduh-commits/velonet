import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getLoggedInStudent } from "@/lib/student-auth";
import { awardXP, evaluateBadges } from "@/lib/gamification";

export async function POST(req: Request) {
  try {
    const student = await getLoggedInStudent();
    if (!student) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 },
      );
    }

    const body = await req.json();
    const { quizId, answers } = body;

    if (!quizId || !Array.isArray(answers)) {
      return NextResponse.json(
        { success: false, error: "Invalid payload" },
        { status: 400 },
      );
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
        { status: 404 },
      );
    }

    let score = 0;
    let totalScore = 0;

    const formattedAnswers = answers.map((ans: any) => {
      const question = quiz.questions.find((q) => q.id === ans.questionId);
      if (question) {
        totalScore += question.points;
        const selectedOption = question.options.find(
          (opt) => opt.id === ans.optionId,
        );
        if (selectedOption && selectedOption.isCorrect) {
          score += question.points;
        }
      }
      return {
        questionId: ans.questionId,
        optionId: ans.optionId,
      };
    });

    const quizAttempt = await prisma.quizAttempt.create({
      data: {
        quizId,
        userId: student.id,
        score,
        totalScore,
        answers: JSON.stringify(formattedAnswers),
      },
    });

    try {
      await awardXP(student.id, 50, "Menyelesaikan Kuis");
      await evaluateBadges(student.id);
    } catch (xpErr) {
      console.error("[Quiz API POST] Error awarding XP:", xpErr);
    }

    return NextResponse.json({ success: true, data: quizAttempt });
  } catch (err) {
    console.error("[Quiz API POST]", err);
    return NextResponse.json(
      { success: false, error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
