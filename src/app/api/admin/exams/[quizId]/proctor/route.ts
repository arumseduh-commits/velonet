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
          select: { id: true, text: true, points: true, order: true, type: true },
          orderBy: { order: "asc" },
        },
      },
    });

    if (!quiz) {
      return NextResponse.json({ success: false, error: "Ujian / Kuis tidak ditemukan." }, { status: 404 });
    }

    // Fetch all attempts for this quiz with user info, detailed answers and recent violation logs
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
        detailedAnswers: {
          select: {
            questionId: true,
            selectedOptionIds: true,
            textResponse: true,
            earnedPoints: true,
          },
        },
        violations: {
          orderBy: { timestamp: "desc" },
          take: 5,
        },
      },
      orderBy: { updatedAt: "desc" },
    });

    const totalQuestions = quiz.questions.length;
    const calculatedQuizTotalPoints = quiz.questions.reduce((acc, q) => acc + (q.points || 0), 0);

    const formattedAttempts = attempts
      .map((att) => {
        const answeredQuestionIdsSet = new Set<string>();

        if (att.answers) {
          try {
            const parsed = JSON.parse(att.answers);
            if (typeof parsed === "object" && parsed !== null) {
              Object.entries(parsed).forEach(([qId, val]: [string, any]) => {
                if (
                  val &&
                  (val.optionId ||
                    (Array.isArray(val.selectedOptionIds) && val.selectedOptionIds.length > 0) ||
                    (typeof val.textResponse === "string" && val.textResponse.trim().length > 0) ||
                    (typeof val === "string" && val.trim().length > 0))
                ) {
                  answeredQuestionIdsSet.add(qId);
                }
              });
            }
          } catch (e) {}
        }

        if (att.detailedAnswers && att.detailedAnswers.length > 0) {
          att.detailedAnswers.forEach((a) => {
            let hasOptions = false;
            if (a.selectedOptionIds) {
              try {
                const parsed = JSON.parse(a.selectedOptionIds);
                hasOptions = Array.isArray(parsed) && parsed.length > 0;
              } catch (e) {}
            }
            const hasText = Boolean(a.textResponse && a.textResponse.trim());
            if (hasOptions || hasText) {
              answeredQuestionIdsSet.add(a.questionId);
            }
          });
        }

        const answeredQuestionIds = Array.from(answeredQuestionIdsSet);
        const answeredCount = answeredQuestionIds.length;
        const progressPercentage = totalQuestions > 0 ? Math.round((answeredCount / totalQuestions) * 100) : 0;

        return {
          id: att.id,
          studentId: att.userId,
          userId: att.userId,
          studentName: att.user?.name || "Peserta Tanpa Nama",
          userName: att.user?.name || "Peserta Tanpa Nama",
          phoneNumber: att.user?.phoneNumber || "-",
          studentClass: att.user?.studentClass || "-",
          status: att.status as "IN_PROGRESS" | "LOCKED" | "SUBMITTED" | "GRADED" | "DISQUALIFIED",
          strikes: att.strikeCount,
          strikeCount: att.strikeCount,
          score: att.score,
          totalScore: att.totalScore || calculatedQuizTotalPoints,
          answeredCount,
          totalQuestions,
          progressPercentage,
          answeredQuestionIds,
          startedAt: att.startedAt,
          submittedAt: att.submittedAt,
          updatedAt: att.updatedAt,
          lastPing: att.updatedAt,
          violations: att.violations,
        };
      })
      .sort((a, b) => {
        // Disqualified always at the bottom
        if (a.status === "DISQUALIFIED" && b.status !== "DISQUALIFIED") return 1;
        if (b.status === "DISQUALIFIED" && a.status !== "DISQUALIFIED") return -1;
        // Higher score first
        if (b.score !== a.score) return b.score - a.score;
        // Higher answered count first
        if (b.answeredCount !== a.answeredCount) return b.answeredCount - a.answeredCount;
        return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
      });

    // Stats breakdown
    const stats = {
      totalParticipants: formattedAttempts.length,
      inProgress: formattedAttempts.filter((a) => a.status === "IN_PROGRESS").length,
      locked: formattedAttempts.filter((a) => a.status === "LOCKED").length,
      submitted: formattedAttempts.filter((a) => a.status === "SUBMITTED" || a.status === "GRADED").length,
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
          questions: quiz.questions,
        },
        stats,
        attempts: formattedAttempts,
        participants: formattedAttempts,
      },
    });
  } catch (err) {
    console.error("[Admin Exam Proctor API GET]", err);
    return NextResponse.json({ success: false, error: "Internal Server Error" }, { status: 500 });
  }
}
