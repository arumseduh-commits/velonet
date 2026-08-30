import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const monthParam = searchParams.get("month"); // e.g. "8" or "ALL"
    const yearParam = searchParams.get("year");   // e.g. "2026" or "ALL"

    const query = searchParams.get("query") || "";
    const pageParam = searchParams.get("page");
    const limitParam = searchParams.get("limit");

    const page = Math.max(1, parseInt(pageParam || "1", 10) || 1);
    const isAll = limitParam === "ALL";
    const limit = isAll ? undefined : (parseInt(limitParam || "", 10) || 10);

    // 1. Fetch all completed/registered participants
    const participants = await prisma.user.findMany({
      where: {
        isExcluded: false,
        ...(query
          ? {
              OR: [
                { name: { contains: query, mode: "insensitive" } },
                { phoneNumber: { contains: query } },
                { studentClass: { contains: query, mode: "insensitive" } },
              ],
            }
          : {}),
      },
      select: {
        id: true,
        name: true,
        phoneNumber: true,
        studentClass: true,
        status: true,
      },
      orderBy: { name: "asc" },
    });

    // 2. Fetch all meeting sessions (optionally filtered by date)
    const allSessions = await prisma.meetingSession.findMany({
      orderBy: { date: "desc" },
      include: {
        attendances: {
          select: {
            userId: true,
            status: true,
          },
        },
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
    const allReportData = participants.map((p) => {
      let hadirCount = 0;
      let izinCount = 0;
      let alpaCount = 0;

      filteredSessions.forEach((s) => {
        const att = s.attendances.find((a) => a.userId === p.id);
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

    const totalItems = allReportData.length;
    const totalPages = isAll || !limit ? 1 : Math.ceil(totalItems / limit) || 1;
    const paginatedReport = isAll || !limit
      ? allReportData
      : allReportData.slice((page - 1) * limit, page * limit);

    return NextResponse.json({
      success: true,
      totalSessions: totalSessionsCount,
      totalParticipants: totalItems,
      report: paginatedReport,
      pagination: {
        total: totalItems,
        page: isAll ? 1 : page,
        limit: isAll ? "ALL" : (limit || totalItems),
        totalPages,
        hasNext: !isAll && page < totalPages,
        hasPrev: !isAll && page > 1,
      },
    });
  } catch (error: any) {
    console.error("GET /api/reports/cumulative error:", error);
    return NextResponse.json(
      { error: "Gagal mengambil data laporan kumulatif" },
      { status: 500 }
    );
  }
}
