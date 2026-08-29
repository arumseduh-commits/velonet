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
          isPreview: true,
        },
      });
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

    // Find or create attempt for student
    let attempt = await prisma.quizAttempt.findFirst({
      where: {
        quizId,
        userId: student!.id,
      },
      orderBy: { createdAt: "desc" },
    });

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

    return NextResponse.json({
      success: true,
      data: {
        attemptId: attempt.id,
        status: attempt.status,
        strikeCount: attempt.strikeCount,
        startedAt: attempt.startedAt,
      },
    });
  } catch (err) {
    console.error("[Quiz API START]", err);
    return NextResponse.json({ success: false, error: "Internal Server Error" }, { status: 500 });
  }
}
