import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getLoggedInAdmin } from "@/lib/admin-auth";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ quizId: string }> }
) {
  try {
    const admin = await getLoggedInAdmin();
    if (!admin) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const { quizId } = await params;

    const quiz = await prisma.quiz.findUnique({
      where: { id: quizId },
      include: {
        questions: {
          select: { id: true, text: true, points: true },
        },
      },
    });

    if (!quiz) {
      return NextResponse.json({ success: false, error: "Ujian / Kuis tidak ditemukan." }, { status: 404 });
    }

    // Fetch all attempts for this quiz with user info and recent violation logs
    const attempts = await prisma.quizAttempt.findMany({
      where: { quizId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            phoneNumber: true,
            studentClass: true,
          },
        },
        violations: {
          orderBy: { timestamp: "desc" },
          take: 5,
        },
      },
      orderBy: { updatedAt: "desc" },
    });

    const formattedAttempts = attempts.map((att) => ({
      id: att.id,
      userId: att.userId,
      userName: att.user?.name || "Peserta Tanpa Nama",
      phoneNumber: att.user?.phoneNumber || "-",
      studentClass: att.user?.studentClass || "-",
      status: att.status,
      strikeCount: att.strikeCount,
      score: att.score,
      totalScore: att.totalScore,
      startedAt: att.startedAt,
      submittedAt: att.submittedAt,
      updatedAt: att.updatedAt,
      violations: att.violations,
    }));

    // Stats breakdown
    const stats = {
      totalParticipants: formattedAttempts.length,
      inProgress: formattedAttempts.filter((a) => a.status === "IN_PROGRESS").length,
      locked: formattedAttempts.filter((a) => a.status === "LOCKED").length,
      submitted: formattedAttempts.filter((a) => a.status === "SUBMITTED").length,
      disqualified: formattedAttempts.filter((a) => a.status === "DISQUALIFIED").length,
    };

    return NextResponse.json({
      success: true,
      data: {
        quiz: {
          id: quiz.id,
          title: quiz.title,
          description: quiz.description,
          durationMinutes: quiz.durationMinutes,
          maxStrikes: quiz.maxStrikes,
          supervisorPin: quiz.supervisorPin,
          enableCameraProctor: quiz.enableCameraProctor,
          enableFullscreenLock: quiz.enableFullscreenLock,
          totalQuestions: quiz.questions.length,
        },
        stats,
        attempts: formattedAttempts,
      },
    });
  } catch (err) {
    console.error("[Admin Exam Proctor API GET]", err);
    return NextResponse.json({ success: false, error: "Internal Server Error" }, { status: 500 });
  }
}
