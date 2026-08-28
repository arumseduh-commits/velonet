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
    const { attemptId, action, reason } = body;

    if (!attemptId || !action) {
      return NextResponse.json({ success: false, error: "Parameter tidak lengkap." }, { status: 400 });
    }

    const attempt = await prisma.quizAttempt.findUnique({
      where: { id: attemptId },
      include: {
        quiz: {
          include: {
            questions: {
              include: {
                options: true,
              },
            },
          },
        },
      },
    });

    if (!attempt || attempt.quizId !== quizId) {
      return NextResponse.json({ success: false, error: "Attempt ujian tidak ditemukan." }, { status: 404 });
    }

    let updatedAttempt: any = null;

    switch (action) {
      case "UNLOCK": {
        updatedAttempt = await prisma.quizAttempt.update({
          where: { id: attemptId },
          data: {
            status: "IN_PROGRESS",
            strikeCount: 0,
          },
        });
        await prisma.examViolationLog.create({
          data: {
            attemptId,
            type: "REMOTE_UNLOCKED",
            description: `Ujian dibuka kembali oleh Pengawas/Admin (${admin.username || "Admin"}). Alasan: ${reason || "Diberikan izin pengawas"}`,
          },
        });
        break;
      }

      case "RESET_STRIKES": {
        updatedAttempt = await prisma.quizAttempt.update({
          where: { id: attemptId },
          data: {
            strikeCount: 0,
          },
        });
        await prisma.examViolationLog.create({
          data: {
            attemptId,
            type: "STRIKES_RESET",
            description: `Pelanggaran siswa disetel ulang ke 0 oleh Pengawas/Admin (${admin.username || "Admin"}).`,
          },
        });
        break;
      }

      case "FORCE_SUBMIT": {
        // Calculate score from current saved answers if any
        let score = 0;
        let totalScore = 0;

        if (attempt.answers) {
          try {
            const parsedAnswers = JSON.parse(attempt.answers);
            if (Array.isArray(parsedAnswers)) {
              parsedAnswers.forEach((ans: any) => {
                const question = attempt.quiz.questions.find((q) => q.id === ans.questionId);
                if (question) {
                  totalScore += question.points;
                  const selectedOption = question.options.find((opt) => opt.id === ans.optionId);
                  if (selectedOption && selectedOption.isCorrect) {
                    score += question.points;
                  }
                }
              });
            }
          } catch (e) {
            console.error("Failed to parse answers on force submit:", e);
          }
        }

        updatedAttempt = await prisma.quizAttempt.update({
          where: { id: attemptId },
          data: {
            status: "SUBMITTED",
            submittedAt: new Date(),
            score,
          },
        });

        await prisma.examViolationLog.create({
          data: {
            attemptId,
            type: "FORCE_SUBMITTED",
            description: `Ujian diselesaikan paksa oleh Pengawas/Admin (${admin.username || "Admin"}). Alasan: ${reason || "Waktu habis / instruksi pengawas"}`,
          },
        });
        break;
      }

      case "DISQUALIFY": {
        updatedAttempt = await prisma.quizAttempt.update({
          where: { id: attemptId },
          data: {
            status: "DISQUALIFIED",
            score: 0,
            submittedAt: new Date(),
          },
        });

        await prisma.examViolationLog.create({
          data: {
            attemptId,
            type: "DISQUALIFIED",
            description: `Peserta didiskualifikasi oleh Pengawas/Admin (${admin.username || "Admin"}). Alasan: ${reason || "Pelanggaran berat tata tertib ujian"}`,
          },
        });
        break;
      }

      default:
        return NextResponse.json({ success: false, error: `Aksi tidak dikenal: ${action}` }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      message: `Aksi ${action} berhasil diterapkan.`,
      data: updatedAttempt,
    });
  } catch (err) {
    console.error("[Admin Exam Proctor Action POST]", err);
    return NextResponse.json({ success: false, error: "Internal Server Error" }, { status: 500 });
  }
}
