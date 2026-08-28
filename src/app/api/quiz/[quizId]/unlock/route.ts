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
    const { supervisorPin } = body;

    const quiz = await prisma.quiz.findUnique({
      where: { id: quizId },
    });

    if (!quiz) {
      return NextResponse.json({ success: false, error: "Kuis tidak ditemukan." }, { status: 404 });
    }

    if (!supervisorPin || supervisorPin.trim() !== (quiz.supervisorPin || "123456")) {
      return NextResponse.json(
        { success: false, error: "PIN Pengawas tidak valid. Silakan hubungi pengawas/mentor." },
        { status: 400 }
      );
    }

    const attempt = await prisma.quizAttempt.findFirst({
      where: {
        quizId,
        userId: student.id,
      },
      orderBy: { createdAt: "desc" },
    });

    if (!attempt) {
      return NextResponse.json({ success: false, error: "Sesi ujian tidak ditemukan." }, { status: 404 });
    }

    // Unlock attempt and reset strike count back to 0 or max-1 so student can continue
    const updated = await prisma.quizAttempt.update({
      where: { id: attempt.id },
      data: {
        status: "IN_PROGRESS",
        strikeCount: 0,
      },
    });

    // Log supervisor unlock action
    await prisma.examViolationLog.create({
      data: {
        attemptId: attempt.id,
        type: "SUPERVISOR_UNLOCKED",
        description: "Ujian dibuka kembali oleh Pengawas/Mentor melalui input PIN.",
      },
    });

    return NextResponse.json({
      success: true,
      message: "Ujian berhasil dibuka kembali. Silakan lanjutkan pengerjaan.",
      data: {
        status: updated.status,
        strikeCount: updated.strikeCount,
      },
    });
  } catch (err) {
    console.error("[Quiz API UNLOCK]", err);
    return NextResponse.json({ success: false, error: "Internal Server Error" }, { status: 500 });
  }
}
