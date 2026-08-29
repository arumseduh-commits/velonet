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
        questions: { select: { points: true } },
      },
    });

    if (!quiz) {
      return NextResponse.json({ success: false, error: "Ujian tidak ditemukan." }, { status: 404 });
    }

    const totalScore = quiz.questions.reduce((acc, q) => acc + (q.points || 0), 0);

    // Check if score is visible
    const isScoreVisible =
      admin ||
      quiz.showScoreImmediately ||
      (quiz.scoreReleaseAt && new Date() >= new Date(quiz.scoreReleaseAt));

    if (!isScoreVisible) {
      return NextResponse.json({
        success: true,
        data: {
          quizTitle: quiz.title,
          totalScore,
          scoreReleased: false,
          scoreReleaseAt: quiz.scoreReleaseAt,
          leaderboard: [],
        },
      });
    }

    // Fetch valid submitted attempts
    const attempts = await prisma.quizAttempt.findMany({
      where: {
        quizId,
        status: { in: ["SUBMITTED", "GRADED"] },
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            studentClass: true,
          },
        },
      },
      orderBy: [
        { score: "desc" },
        { submittedAt: "asc" },
      ],
      take: 50,
    });

    const leaderboard = attempts.map((att, idx) => {
      let durationMinutes: number | null = null;
      if (att.startedAt && att.submittedAt) {
        durationMinutes = Math.max(1, Math.round((att.submittedAt.getTime() - att.startedAt.getTime()) / 60000));
      }

      const percentage = totalScore > 0 ? Math.round((att.score / totalScore) * 100) : 0;

      return {
        rank: idx + 1,
        userId: att.userId,
        name: att.user.name,
        studentClass: att.user.studentClass,
        score: att.score,
        totalScore,
        percentage,
        durationMinutes,
        submittedAt: att.submittedAt ? att.submittedAt.toISOString() : att.createdAt.toISOString(),
      };
    });

    return NextResponse.json({
      success: true,
      data: {
        quizTitle: quiz.title,
        totalScore,
        scoreReleased: true,
        scoreReleaseAt: quiz.scoreReleaseAt,
        leaderboard,
      },
    });
  } catch (err: any) {
    console.error("[Exam Leaderboard API]", err);
    return NextResponse.json({ success: false, error: "Internal Server Error" }, { status: 500 });
  }
}
