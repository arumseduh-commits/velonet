import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getLoggedInAdmin } from "@/lib/admin-auth";
import { parseQuestionContent } from "@/lib/question-utils";

export async function GET(
  req: NextRequest,
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
          orderBy: { order: "asc" },
          include: {
            options: true,
          },
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
    });

    if (!quiz) {
      return NextResponse.json({ success: false, error: "Modul ujian tidak ditemukan." }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: quiz });
  } catch (err: any) {
    console.error("[Admin Exam GET by ID API]", err);
    return NextResponse.json(
      { success: false, error: err.message || "Gagal memuat modul ujian." },
      { status: 500 }
    );
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ quizId: string }> }
) {
  try {
    const admin = await getLoggedInAdmin();
    if (!admin) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const { quizId } = await params;
    const body = await req.json();

    const {
      title,
      description,
      openAt,
      closeAt,
      durationMinutes,
      enableFullscreenLock,
      enableTabSwitchDetect,
      maxStrikes,
      enableCameraProctor,
      supervisorPin,
      shuffleQuestions,
      shuffleOptions,
      examToken,
      showScoreImmediately,
      scoreReleaseAt,
      showDiscussion,
      questions, // if provided, sync questions
    } = body;

    const existing = await prisma.quiz.findUnique({ where: { id: quizId } });
    if (!existing) {
      return NextResponse.json({ success: false, error: "Modul ujian tidak ditemukan." }, { status: 404 });
    }

    // Validate Window of Availability if updating dates
    const effectiveOpenAt = openAt !== undefined ? (openAt ? new Date(openAt) : null) : existing.openAt;
    const effectiveCloseAt = closeAt !== undefined ? (closeAt ? new Date(closeAt) : null) : existing.closeAt;

    if (effectiveOpenAt && isNaN(effectiveOpenAt.getTime())) {
      return NextResponse.json({ success: false, error: "Format tanggal/waktu jadwal buka (openAt) tidak valid." }, { status: 400 });
    }
    if (effectiveCloseAt && isNaN(effectiveCloseAt.getTime())) {
      return NextResponse.json({ success: false, error: "Format tanggal/waktu jadwal tutup (closeAt) tidak valid." }, { status: 400 });
    }
    if (effectiveOpenAt && effectiveCloseAt && effectiveOpenAt >= effectiveCloseAt) {
      return NextResponse.json(
        { success: false, error: "Jadwal tutup ujian (closeAt) harus lebih akhir dari jadwal buka ujian (openAt)." },
        { status: 400 }
      );
    }

    // Update Quiz Info & Settings
    await prisma.quiz.update({
      where: { id: quizId },
      data: {
        ...(title !== undefined && { title: title.trim() }),
        ...(description !== undefined && { description: description?.trim() || null }),
        ...(openAt !== undefined && { openAt: openAt ? new Date(openAt) : null }),
        ...(closeAt !== undefined && { closeAt: closeAt ? new Date(closeAt) : null }),
        ...(durationMinutes !== undefined && { durationMinutes: Number(durationMinutes) || 30 }),
        ...(enableFullscreenLock !== undefined && { enableFullscreenLock: Boolean(enableFullscreenLock) }),
        ...(enableTabSwitchDetect !== undefined && { enableTabSwitchDetect: Boolean(enableTabSwitchDetect) }),
        ...(maxStrikes !== undefined && { maxStrikes: Number(maxStrikes) || 3 }),
        ...(enableCameraProctor !== undefined && { enableCameraProctor: Boolean(enableCameraProctor) }),
        ...(supervisorPin !== undefined && { supervisorPin: supervisorPin?.trim() || "123456" }),
        ...(shuffleQuestions !== undefined && { shuffleQuestions: Boolean(shuffleQuestions) }),
        ...(shuffleOptions !== undefined && { shuffleOptions: Boolean(shuffleOptions) }),
        ...(examToken !== undefined && {
          examToken: examToken && examToken.trim() ? examToken.trim().toUpperCase() : null,
        }),
        ...(showScoreImmediately !== undefined && { showScoreImmediately: Boolean(showScoreImmediately) }),
        ...(scoreReleaseAt !== undefined && {
          scoreReleaseAt: scoreReleaseAt ? new Date(scoreReleaseAt) : null,
        }),
        ...(showDiscussion !== undefined && { showDiscussion: Boolean(showDiscussion) }),
      },
    });

    // If questions array is passed, sync questions transactionally
    if (Array.isArray(questions)) {
      // Delete existing questions that are not in the new list, or cleanly replace questions
      await prisma.$transaction(async (tx) => {
        // Remove existing questions for this quiz
        await tx.question.deleteMany({
          where: { quizId },
        });

        // Insert new questions with options
        for (let i = 0; i < questions.length; i++) {
          const q = questions[i];
          const { cleanText, imageUrl } = parseQuestionContent(q.text, q.imageUrl);
          await tx.question.create({
            data: {
              quizId,
              type: q.type || "SINGLE_CHOICE",
              text: cleanText || `Soal #${i + 1}`,
              imageUrl: imageUrl || null,
              points: Number(q.points) || 10,
              order: q.order !== undefined ? q.order : i,
              explanation: q.explanation?.trim() || null,
              sampleAnswer: q.sampleAnswer || null,
              gradingRubric: q.gradingRubric || null,
              caseSensitive: Boolean(q.caseSensitive),
              options: {
                create: (q.options || []).map((opt: any) => ({
                  text: opt.text || "",
                  isCorrect: Boolean(opt.isCorrect),
                })),
              },
            },
          });
        }
      });
    }

    const updatedQuiz = await prisma.quiz.findUnique({
      where: { id: quizId },
      include: {
        questions: {
          orderBy: { order: "asc" },
          include: { options: true },
        },
      },
    });

    return NextResponse.json({
      success: true,
      message: "Modul ujian dan butir soal berhasil diperbarui.",
      data: updatedQuiz,
    });
  } catch (err: any) {
    console.error("[Admin Exam PATCH API]", err);
    return NextResponse.json(
      { success: false, error: err.message || "Gagal memperbarui modul ujian." },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ quizId: string }> }
) {
  try {
    const admin = await getLoggedInAdmin();
    if (!admin) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const { quizId } = await params;

    const existing = await prisma.quiz.findUnique({ where: { id: quizId } });
    if (!existing) {
      return NextResponse.json({ success: false, error: "Modul ujian tidak ditemukan." }, { status: 404 });
    }

    await prisma.quiz.delete({
      where: { id: quizId },
    });

    return NextResponse.json({
      success: true,
      message: "Modul ujian berhasil dihapus.",
    });
  } catch (err: any) {
    console.error("[Admin Exam DELETE API]", err);
    return NextResponse.json(
      { success: false, error: err.message || "Gagal menghapus modul ujian." },
      { status: 500 }
    );
  }
}
