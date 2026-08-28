import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getLoggedInAdmin } from "@/lib/admin-auth";

export async function GET() {
  try {
    const admin = await getLoggedInAdmin();
    if (!admin) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const quizzes = await prisma.quiz.findMany({
      include: {
        questions: {
          select: { id: true },
        },
        attempts: {
          select: {
            id: true,
            status: true,
            strikeCount: true,
            score: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    const formatted = quizzes.map((q) => {
      const totalParticipants = q.attempts.length;
      const inProgress = q.attempts.filter((a) => a.status === "IN_PROGRESS").length;
      const locked = q.attempts.filter((a) => a.status === "LOCKED").length;
      const submitted = q.attempts.filter((a) => a.status === "SUBMITTED").length;

      return {
        id: q.id,
        title: q.title,
        description: q.description,
        durationMinutes: q.durationMinutes,
        enableFullscreenLock: q.enableFullscreenLock,
        enableTabSwitchDetect: q.enableTabSwitchDetect,
        maxStrikes: q.maxStrikes,
        enableCameraProctor: q.enableCameraProctor,
        supervisorPin: q.supervisorPin,
        questionCount: q.questions.length,
        stats: {
          totalParticipants,
          inProgress,
          locked,
          submitted,
        },
        createdAt: q.createdAt,
      };
    });

    return NextResponse.json({ success: true, data: formatted });
  } catch (err) {
    console.error("[Admin Exams API GET]", err);
    return NextResponse.json({ success: false, error: "Internal Server Error" }, { status: 500 });
  }
}
