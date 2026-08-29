import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getLoggedInStudent } from "@/lib/student-auth";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const student = await getLoggedInStudent();
    if (!student) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const quizzes = await prisma.quiz.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        questions: {
          select: {
            id: true,
            points: true,
          },
        },
        attempts: {
          where: { userId: student.id },
          orderBy: { createdAt: "desc" },
          take: 1,
          select: {
            id: true,
            status: true,
            score: true,
            totalScore: true,
            isFullyGraded: true,
            strikeCount: true,
            startedAt: true,
            submittedAt: true,
          },
        },
      },
    });

    const formattedExams = quizzes.map((q) => {
      const latestAttempt = q.attempts[0] || null;
      const totalPoints = q.questions.reduce((acc, item) => acc + (item.points || 0), 0);

      const now = new Date();
      const isUpcoming = Boolean(q.openAt && now < new Date(q.openAt));
      const isPastClose = Boolean(q.closeAt && now > new Date(q.closeAt));
      const hasStarted = Boolean(latestAttempt && latestAttempt.startedAt);

      let availability: "UPCOMING" | "OPEN" | "CLOSED" = "OPEN";
      if (isUpcoming) {
        availability = "UPCOMING";
      } else if (isPastClose && !hasStarted) {
        availability = "CLOSED";
      } else {
        availability = "OPEN";
      }

      const isScoreVisible =
        q.showScoreImmediately ||
        (q.scoreReleaseAt && new Date() >= new Date(q.scoreReleaseAt));
      const isDiscussionVisible = Boolean(q.showDiscussion) && isScoreVisible;

      return {
        id: q.id,
        title: q.title,
        description: q.description,
        openAt: q.openAt ? q.openAt.toISOString() : null,
        closeAt: q.closeAt ? q.closeAt.toISOString() : null,
        availability,
        durationMinutes: q.durationMinutes || 30,
        totalQuestions: q.questions.length,
        totalPoints,
        enableFullscreenLock: q.enableFullscreenLock ?? true,
        enableTabSwitchDetect: q.enableTabSwitchDetect ?? true,
        enableCameraProctor: q.enableCameraProctor ?? false,
        maxStrikes: q.maxStrikes || 3,
        hasExamToken: Boolean(q.examToken),
        showScoreImmediately: q.showScoreImmediately ?? true,
        scoreReleaseAt: q.scoreReleaseAt ? q.scoreReleaseAt.toISOString() : null,
        showDiscussion: q.showDiscussion ?? false,
        isScoreVisible,
        isDiscussionVisible,
        createdAt: q.createdAt,
        attempt: latestAttempt
          ? {
              id: latestAttempt.id,
              status: latestAttempt.status,
              score: isScoreVisible ? latestAttempt.score : null,
              totalScore: latestAttempt.totalScore ?? totalPoints,
              isFullyGraded: latestAttempt.isFullyGraded,
              strikeCount: latestAttempt.strikeCount,
              startedAt: latestAttempt.startedAt,
              submittedAt: latestAttempt.submittedAt,
            }
          : null,
      };
    });

    return NextResponse.json({
      success: true,
      data: formattedExams,
    });
  } catch (err: any) {
    console.error("[StudentExamsAPI] Error:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Gagal memuat daftar ujian." },
      { status: 500 }
    );
  }
}
