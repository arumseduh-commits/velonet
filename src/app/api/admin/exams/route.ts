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
        openAt: q.openAt ? q.openAt.toISOString() : null,
        closeAt: q.closeAt ? q.closeAt.toISOString() : null,
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

export async function POST(req: Request) {
  try {
    const admin = await getLoggedInAdmin();
    if (!admin) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const {
      title,
      description,
      openAt = null,
      closeAt = null,
      durationMinutes = 30,
      enableFullscreenLock = true,
      enableTabSwitchDetect = true,
      maxStrikes = 3,
      enableCameraProctor = false,
      supervisorPin = "123456",
      shuffleQuestions = true,
      shuffleOptions = true,
      examToken = null,
      showScoreImmediately = true,
      scoreReleaseAt = null,
      showDiscussion = false,
      questions = [],
    } = body;

    if (!title || !title.trim()) {
      return NextResponse.json({ success: false, error: "Judul ujian wajib diisi." }, { status: 400 });
    }

    // Validate Window of Availability (openAt & closeAt)
    const parsedOpenAt = openAt ? new Date(openAt) : null;
    const parsedCloseAt = closeAt ? new Date(closeAt) : null;

    if (parsedOpenAt && isNaN(parsedOpenAt.getTime())) {
      return NextResponse.json({ success: false, error: "Format tanggal/waktu jadwal buka (openAt) tidak valid." }, { status: 400 });
    }
    if (parsedCloseAt && isNaN(parsedCloseAt.getTime())) {
      return NextResponse.json({ success: false, error: "Format tanggal/waktu jadwal tutup (closeAt) tidak valid." }, { status: 400 });
    }
    if (parsedOpenAt && parsedCloseAt && parsedOpenAt >= parsedCloseAt) {
      return NextResponse.json(
        { success: false, error: "Jadwal tutup ujian (closeAt) harus lebih akhir dari jadwal buka ujian (openAt)." },
        { status: 400 }
      );
    }

    // Create Quiz in Database
    const newQuiz = await prisma.quiz.create({
      data: {
        title: title.trim(),
        description: description?.trim() || null,
        openAt: parsedOpenAt,
        closeAt: parsedCloseAt,
        durationMinutes: Number(durationMinutes) || 30,
        enableFullscreenLock: Boolean(enableFullscreenLock),
        enableTabSwitchDetect: Boolean(enableTabSwitchDetect),
        maxStrikes: Number(maxStrikes) || 3,
        enableCameraProctor: Boolean(enableCameraProctor),
        supervisorPin: supervisorPin?.trim() || "123456",
        shuffleQuestions: Boolean(shuffleQuestions),
        shuffleOptions: Boolean(shuffleOptions),
        examToken: examToken && examToken.trim() ? examToken.trim().toUpperCase() : null,
        showScoreImmediately: Boolean(showScoreImmediately),
        scoreReleaseAt: scoreReleaseAt ? new Date(scoreReleaseAt) : null,
        showDiscussion: Boolean(showDiscussion),
        questions: {
          create: questions.map((q: any, idx: number) => ({
            type: q.type || "SINGLE_CHOICE",
            text: q.text || `Soal #${idx + 1}`,
            imageUrl: q.imageUrl || null,
            points: Number(q.points) || 10,
            order: q.order !== undefined ? q.order : idx,
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
          })),
        },
      },
      include: {
        questions: {
          include: {
            options: true,
          },
        },
      },
    });

    return NextResponse.json({
      success: true,
      message: "Modul ujian berhasil dibuat.",
      data: newQuiz,
    });
  } catch (err: any) {
    console.error("[Admin Exams API POST]", err);
    return NextResponse.json(
      { success: false, error: err.message || "Gagal membuat modul ujian." },
      { status: 500 }
    );
  }
}

