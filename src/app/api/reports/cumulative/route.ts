import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const monthParam = searchParams.get("month"); // e.g. "8" or "ALL"
    const yearParam = searchParams.get("year");   // e.g. "2026" or "ALL"

    // 1. Fetch all completed/registered participants
    const participants = await prisma.participant.findMany({
      where: {
        isExcluded: false,
      },
      orderBy: { name: "asc" },
    });

    // 2. Fetch all meeting sessions (optionally filtered by date)
    const allSessions = await prisma.meetingSession.findMany({
      orderBy: { date: "desc" },
      include: {
        attendances: true,
      },
    });

    // Filter sessions by month/year if specified
    const filteredSessions = allSessions.filter((s) => {
      const d = new Date(s.date);
      const mMatch = !monthParam || monthParam === "ALL" || (d.getMonth() + 1).toString() === monthParam;
      const yMatch = !yearParam || yearParam === "ALL" || d.getFullYear().toString() === yearParam;
      return mMatch && yMatch;
    });

    const totalSessionsCount = filteredSessions.length;
    const now = new Date();

    // 3. Aggregate cumulative statistics per participant
    const reportData = participants.map((p) => {
      let hadirCount = 0;
      let izinCount = 0;
      let alpaCount = 0;

      filteredSessions.forEach((s) => {
        const att = s.attendances.find((a) => a.participantId === p.id);
        const isClosed = now > new Date(s.endTime) || s.isCancelled;

        if (att) {
          if (att.status === "HADIR") hadirCount++;
          else if (att.status === "IZIN" || att.status === "SAKIT") izinCount++;
          else if (att.status === "ALPA") alpaCount++;
        } else if (isClosed) {
          // Un-checked participant after session closed is ALPA
          alpaCount++;
        }
      });

      const percentage = totalSessionsCount > 0
        ? Math.round((hadirCount / totalSessionsCount) * 100)
        : 0;

      return {
        participantId: p.id,
        name: p.name || "Tanpa Nama",
        phoneNumber: p.phoneNumber,
        studentClass: p.studentClass || "-",
        registrationStatus: p.status,
        totalSessions: totalSessionsCount,
        hadirCount,
        izinCount,
        alpaCount,
        percentage,
      };
    });

    return NextResponse.json({
      success: true,
      totalSessions: totalSessionsCount,
      totalParticipants: participants.length,
      report: reportData,
    });
  } catch (error: any) {
    console.error("GET /api/reports/cumulative error:", error);
    return NextResponse.json(
      { error: "Gagal mengambil data laporan kumulatif" },
      { status: 500 }
    );
  }
}
