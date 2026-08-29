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
    const body = await req.json();
    const { answers, questionId, answer } = body;

    const attempt = await prisma.quizAttempt.findFirst({
      where: {
        quizId,
        userId: student.id,
        status: { in: ["IN_PROGRESS", "LOCKED"] },
      },
      include: {
        quiz: {
          include: {
            questions: {
              include: {
                options: true,
              },
            },
          },
        },
      },
    });

    if (!attempt) {
      return NextResponse.json({ success: false, error: "Sesi ujian aktif tidak ditemukan." }, { status: 404 });
    }

    // Merge answers map
    let currentAnswersMap: Record<string, any> = {};
    if (attempt.answers) {
      try {
        currentAnswersMap = JSON.parse(attempt.answers);
        if (typeof currentAnswersMap !== "object" || currentAnswersMap === null) {
          currentAnswersMap = {};
        }
      } catch (e) {
        currentAnswersMap = {};
      }
    }

    if (answers && typeof answers === "object") {
      currentAnswersMap = { ...currentAnswersMap, ...answers };
    } else if (questionId && answer) {
      currentAnswersMap[questionId] = answer;
    } else {
      return NextResponse.json({ success: false, error: "Payload jawaban tidak valid." }, { status: 400 });
    }

    // Calculate live score for all answered questions
    let currentScore = 0;
    const questions = attempt.quiz.questions;
    const totalQuestions = questions.length;

    // Track questions that were touched to upsert into QuizStudentAnswer
    const upsertPromises: Promise<any>[] = [];

    for (const q of questions) {
      const userAns = currentAnswersMap[q.id];
      if (!userAns) continue;

      let earnedPoints = 0;
      let isAutoGraded = true;
      let selectedOptionIds: string[] = [];
      let textResponse: string | null = null;

      if (q.type === "SINGLE_CHOICE" || q.type === "TRUE_FALSE") {
        const correctOpt = q.options.find((o) => o.isCorrect);
        const selectedId = userAns.optionId;
        if (selectedId) {
          selectedOptionIds = [selectedId];
          if (correctOpt && selectedId === correctOpt.id) {
            earnedPoints = q.points;
          }
        }
      } else if (q.type === "CHECKBOXES") {
        selectedOptionIds = Array.isArray(userAns.selectedOptionIds)
          ? userAns.selectedOptionIds
          : userAns.optionId
          ? [userAns.optionId]
          : [];
        const correctIds = q.options.filter((o) => o.isCorrect).map((o) => o.id);
        const wrongSelected = selectedOptionIds.filter((id) => !correctIds.includes(id));
        const correctSelected = selectedOptionIds.filter((id) => correctIds.includes(id));

        if (wrongSelected.length === 0 && correctSelected.length === correctIds.length && correctIds.length > 0) {
          earnedPoints = q.points;
        } else if (wrongSelected.length === 0 && correctSelected.length > 0 && correctIds.length > 0) {
          earnedPoints = Math.round((correctSelected.length / correctIds.length) * q.points * 10) / 10;
        }
      } else if (q.type === "SHORT_ANSWER") {
        textResponse = typeof userAns.textResponse === "string" ? userAns.textResponse : null;
        const textAns = (textResponse || "").trim();
        const expected = (q.sampleAnswer || q.options.find((o) => o.isCorrect)?.text || "").trim();
        const isMatch = q.caseSensitive
          ? textAns === expected
          : textAns.toLowerCase() === expected.toLowerCase();

        if (textAns && isMatch) {
          earnedPoints = q.points;
        }
      } else if (q.type === "ESSAY") {
        textResponse = typeof userAns.textResponse === "string" ? userAns.textResponse : null;
        isAutoGraded = false;
        earnedPoints = 0;
      }

      currentScore += earnedPoints;

      // Upsert individual QuizStudentAnswer record
      upsertPromises.push(
        prisma.quizStudentAnswer.upsert({
          where: {
            attemptId_questionId: {
              attemptId: attempt.id,
              questionId: q.id,
            },
          },
          update: {
            selectedOptionIds: selectedOptionIds.length > 0 ? JSON.stringify(selectedOptionIds) : null,
            textResponse,
            isAutoGraded,
            earnedPoints,
          },
          create: {
            attemptId: attempt.id,
            questionId: q.id,
            selectedOptionIds: selectedOptionIds.length > 0 ? JSON.stringify(selectedOptionIds) : null,
            textResponse,
            isAutoGraded,
            earnedPoints,
          },
        })
      );
    }

    // Execute upserts in parallel
    if (upsertPromises.length > 0) {
      await Promise.all(upsertPromises);
    }

    const answeredCount = Object.keys(currentAnswersMap).filter((k) => {
      const a = currentAnswersMap[k];
      return (
        a &&
        (a.optionId ||
          (Array.isArray(a.selectedOptionIds) && a.selectedOptionIds.length > 0) ||
          (typeof a.textResponse === "string" && a.textResponse.trim().length > 0))
      );
    }).length;

    // Update attempt with live draft answers and live score
    await prisma.quizAttempt.update({
      where: { id: attempt.id },
      data: {
        answers: JSON.stringify(currentAnswersMap),
        score: currentScore,
      },
    });

    return NextResponse.json({
      success: true,
      answeredCount,
      totalQuestions,
      currentScore,
      data: {
        answeredCount,
        totalQuestions,
        currentScore,
        liveScore: currentScore,
      },
    });
  } catch (err) {
    console.error("[Quiz API PROGRESS]", err);
    return NextResponse.json({ success: false, error: "Internal Server Error" }, { status: 500 });
  }
}
