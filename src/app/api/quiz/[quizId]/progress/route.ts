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
    const { answers } = body;

    if (!answers || typeof answers !== "object") {
      return NextResponse.json({ success: false, error: "Invalid answers payload" }, { status: 400 });
    }

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

    // Calculate live score for auto-gradable questions
    let liveScore = 0;
    const questions = attempt.quiz.questions;

    for (const q of questions) {
      const userAns = answers[q.id];
      if (!userAns) continue;

      if (q.type === "SINGLE_CHOICE" || q.type === "TRUE_FALSE") {
        const correctOpt = q.options.find((o) => o.isCorrect);
        if (correctOpt && userAns.optionId === correctOpt.id) {
          liveScore += q.points;
        }
      } else if (q.type === "CHECKBOXES") {
        const correctOptIds = q.options.filter((o) => o.isCorrect).map((o) => o.id);
        const selectedIds = userAns.selectedOptionIds || [];
        const isMatch =
          correctOptIds.length === selectedIds.length &&
          correctOptIds.every((id) => selectedIds.includes(id));
        if (isMatch) {
          liveScore += q.points;
        }
      }
    }

    // Update attempt with live draft answers and live score
    await prisma.quizAttempt.update({
      where: { id: attempt.id },
      data: {
        answers: JSON.stringify(answers),
        score: liveScore,
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        liveScore,
        answeredCount: Object.keys(answers).length,
      },
    });
  } catch (err) {
    console.error("[Quiz API PROGRESS]", err);
    return NextResponse.json({ success: false, error: "Internal Server Error" }, { status: 500 });
  }
}
