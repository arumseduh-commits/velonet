import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getLoggedInStudent } from "@/lib/student-auth";
import { getLoggedInAdmin } from "@/lib/admin-auth";

export async function POST(
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
    let body: any = {};
    try {
      body = await req.json();
    } catch (e) {
      body = {};
    }

    const quiz = await prisma.quiz.findUnique({
      where: { id: quizId },
      include: {
        questions: true,
      },
    });

    if (!quiz) {
      return NextResponse.json({ success: false, error: "Ujian tidak ditemukan." }, { status: 404 });
    }

    // If Admin Preview Mode, return dummy attempt
    if (admin) {
      return NextResponse.json({
        success: true,
        data: {
          attemptId: "preview-attempt-id",
          status: "IN_PROGRESS",
          strikeCount: 0,
          startedAt: new Date().toISOString(),
          remainingDurationSecs: (quiz.durationMinutes || 30) * 60,
          isPreview: true,
        },
      });
    }

    const now = new Date();

    // 1. Check openAt (Window of Availability - Start)
    if (quiz.openAt && now < new Date(quiz.openAt)) {
      const openDateFormatted = new Date(quiz.openAt).toLocaleString("id-ID", {
        dateStyle: "full",
        timeStyle: "short",
      });
      return NextResponse.json(
        {
          success: false,
          error: `Ujian belum dibuka. Ujian akan dibuka pada ${openDateFormatted} WIB.`,
          openAt: quiz.openAt,
        },
        { status: 403 }
      );
    }

    // Check existing attempt for student
    let attempt = await prisma.quizAttempt.findFirst({
      where: {
        quizId,
        userId: student!.id,
      },
      orderBy: { createdAt: "desc" },
    });

    // 2. Check closeAt (Window of Availability - End)
    if (quiz.closeAt && now > new Date(quiz.closeAt)) {
      const hasActiveAttempt = attempt && (attempt.status === "IN_PROGRESS" || attempt.status === "LOCKED");
      if (!hasActiveAttempt) {
        return NextResponse.json(
          {
            success: false,
            error: "Waktu pengerjaan ujian telah berakhir / ditutup.",
            closeAt: quiz.closeAt,
          },
          { status: 403 }
        );
      }
      // If student already started before closeAt, allow them to finish remaining personal duration
    }

    // Validate Exam Token if required
    if (quiz.examToken && quiz.examToken.trim()) {
      const userToken = (body.token || "").trim().toUpperCase();
      const expectedToken = quiz.examToken.trim().toUpperCase();

      if (!userToken || userToken !== expectedToken) {
        return NextResponse.json(
          {
            success: false,
            error: "Token ujian yang Anda masukkan salah. Silakan minta token resmi ke pengawas/guru di kelas.",
          },
          { status: 403 }
        );
      }
    }

    if (!attempt) {
      const totalPossibleScore = quiz.questions.reduce((acc, q) => acc + q.points, 0);

      attempt = await prisma.quizAttempt.create({
        data: {
          quizId,
          userId: student!.id,
          status: "IN_PROGRESS",
          strikeCount: 0,
          score: 0,
          totalScore: totalPossibleScore,
          startedAt: new Date(),
        },
      });
    }

    // Calculate personal remaining duration
    const elapsedSecs = Math.floor((Date.now() - new Date(attempt.startedAt).getTime()) / 1000);
    const remainingDurationSecs = Math.max(0, (quiz.durationMinutes * 60) - elapsedSecs);

    return NextResponse.json({
      success: true,
      data: {
        attemptId: attempt.id,
        status: attempt.status,
        strikeCount: attempt.strikeCount,
        startedAt: attempt.startedAt,
        remainingDurationSecs,
      },
    });
  } catch (err) {
    console.error("[Quiz API START]", err);
    return NextResponse.json({ success: false, error: "Internal Server Error" }, { status: 500 });
  }
}
