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
    const body = await req.json();
    const { type, description, snapshotUrl } = body;

    const quiz = await prisma.quiz.findUnique({
      where: { id: quizId },
    });

    if (!quiz) {
      return NextResponse.json({ success: false, error: "Ujian tidak ditemukan." }, { status: 404 });
    }

    // If Admin Preview Mode, return simulated violation response
    if (admin) {
      return NextResponse.json({
        success: true,
        data: {
          strikeCount: 1,
          status: "IN_PROGRESS",
          isLocked: false,
          isPreview: true,
        },
      });
    }

    // Find attempt
    let attempt = await prisma.quizAttempt.findFirst({
      where: {
        quizId,
        userId: student!.id,
      },
      orderBy: { createdAt: "desc" },
    });

    if (!attempt) {
      attempt = await prisma.quizAttempt.create({
        data: {
          quizId,
          userId: student!.id,
          status: "IN_PROGRESS",
          strikeCount: 0,
        },
      });
    }

    // Do not log violation if already submitted or disqualified
    if (attempt.status === "SUBMITTED" || attempt.status === "DISQUALIFIED") {
      return NextResponse.json({
        success: true,
        data: {
          strikeCount: attempt.strikeCount,
          status: attempt.status,
          isLocked: false,
        },
      });
    }

    const newStrikeCount = attempt.strikeCount + 1;
    const maxStrikes = quiz.maxStrikes || 3;
    const isLocked = newStrikeCount >= maxStrikes;

    // Log the violation
    await prisma.examViolationLog.create({
      data: {
        attemptId: attempt.id,
        type: type || "UNKNOWN",
        description: description || "Pelanggaran terdeteksi sistem ExamBro",
        snapshotUrl: snapshotUrl || null,
      },
    });

    // Update attempt
    const updatedAttempt = await prisma.quizAttempt.update({
      where: { id: attempt.id },
      data: {
        strikeCount: newStrikeCount,
        status: isLocked ? "LOCKED" : attempt.status,
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        strikeCount: updatedAttempt.strikeCount,
        status: updatedAttempt.status,
        isLocked,
      },
    });
  } catch (err) {
    console.error("[Quiz API VIOLATION]", err);
    return NextResponse.json({ success: false, error: "Internal Server Error" }, { status: 500 });
  }
}
