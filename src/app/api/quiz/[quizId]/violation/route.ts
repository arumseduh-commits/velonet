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
          isReset: true,
          isDisqualified: false,
          maxStrikes: quiz.maxStrikes || 3,
          isPreview: true,
        },
      });
    }

    // Find attempt for student
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

    // Do not process further if already permanently submitted or disqualified
    if (attempt.status === "SUBMITTED" || attempt.status === "DISQUALIFIED") {
      return NextResponse.json({
        success: true,
        data: {
          strikeCount: attempt.strikeCount,
          status: attempt.status,
          isDisqualified: attempt.status === "DISQUALIFIED",
          isReset: false,
          maxStrikes: quiz.maxStrikes || 3,
        },
      });
    }

    const newStrikeCount = attempt.strikeCount + 1;
    const maxStrikes = quiz.maxStrikes || 3;
    const isDisqualified = newStrikeCount >= maxStrikes;

    // Log the violation in database
    await prisma.examViolationLog.create({
      data: {
        attemptId: attempt.id,
        type: type || "UNKNOWN",
        description: description || "Pelanggaran terdeteksi sistem ExamBro",
        snapshotUrl: snapshotUrl || null,
      },
    });

    // Wipe all existing answer records in database (Reset All Answers)
    await prisma.quizStudentAnswer.deleteMany({
      where: { attemptId: attempt.id },
    });

    if (isDisqualified) {
      // Strike 3: Permanently Disqualify with 0 Score
      const updatedAttempt = await prisma.quizAttempt.update({
        where: { id: attempt.id },
        data: {
          strikeCount: newStrikeCount,
          status: "DISQUALIFIED",
          score: 0,
          isFullyGraded: true,
          submittedAt: new Date(),
          answers: null,
        },
      });

      return NextResponse.json({
        success: true,
        data: {
          strikeCount: updatedAttempt.strikeCount,
          status: "DISQUALIFIED",
          isDisqualified: true,
          isReset: true,
          maxStrikes,
          score: 0,
        },
      });
    } else {
      // Strike 1 or 2: Reset Answers to Empty, Status remains IN_PROGRESS
      const updatedAttempt = await prisma.quizAttempt.update({
        where: { id: attempt.id },
        data: {
          strikeCount: newStrikeCount,
          status: "IN_PROGRESS",
          score: 0,
          answers: null,
        },
      });

      return NextResponse.json({
        success: true,
        data: {
          strikeCount: updatedAttempt.strikeCount,
          status: "IN_PROGRESS",
          isDisqualified: false,
          isReset: true,
          maxStrikes,
        },
      });
    }
  } catch (err) {
    console.error("[Quiz API VIOLATION]", err);
    return NextResponse.json({ success: false, error: "Internal Server Error" }, { status: 500 });
  }
}
