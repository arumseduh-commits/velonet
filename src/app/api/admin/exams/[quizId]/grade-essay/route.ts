import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getLoggedInAdmin } from "@/lib/admin-auth";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ quizId: string }> }
) {
  try {
    const admin = await getLoggedInAdmin();
    if (!admin) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const { quizId } = await params;
    const body = await req.json();
    const { attemptId, answerId, teacherScore, teacherFeedback, approveAIScore } = body;

    if (!attemptId || !answerId) {
      return NextResponse.json({ success: false, error: "Parameter tidak lengkap." }, { status: 400 });
    }

    const existingAnswer = await prisma.quizStudentAnswer.findUnique({
      where: { id: answerId },
      include: {
        question: true,
      },
    });

    if (!existingAnswer) {
      return NextResponse.json({ success: false, error: "Jawaban siswa tidak ditemukan." }, { status: 404 });
    }

    const maxPoints = existingAnswer.question.points;
    let finalScore = approveAIScore
      ? (existingAnswer.aiSuggestedScore ?? existingAnswer.earnedPoints)
      : Number(teacherScore);

    if (isNaN(finalScore) || finalScore < 0) finalScore = 0;
    if (finalScore > maxPoints) finalScore = maxPoints;

    // Update the answer record
    await prisma.quizStudentAnswer.update({
      where: { id: answerId },
      data: {
        teacherScore: finalScore,
        teacherFeedback: teacherFeedback || (approveAIScore ? "Nilai rekomendasi AI disetujui Guru." : null),
        earnedPoints: finalScore,
        gradedByUserId: admin.username || "admin",
      },
    });

    // Recalculate total score for the attempt
    const allAnswers = await prisma.quizStudentAnswer.findMany({
      where: { attemptId },
    });

    const newTotalEarned = allAnswers.reduce((acc, a) => acc + a.earnedPoints, 0);

    const updatedAttempt = await prisma.quizAttempt.update({
      where: { id: attemptId },
      data: {
        score: newTotalEarned,
        status: "GRADED",
        isFullyGraded: true,
        gradedAt: new Date(),
      },
    });

    return NextResponse.json({
      success: true,
      message: "Nilai uraian berhasil disimpan dan diperbarui!",
      data: {
        attemptId: updatedAttempt.id,
        newTotalScore: updatedAttempt.score,
      },
    });
  } catch (err: any) {
    console.error("[Grade Essay POST]", err);
    return NextResponse.json({ success: false, error: "Internal Server Error" }, { status: 500 });
  }
}
