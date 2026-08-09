import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const monthParam = searchParams.get("month");
    const yearParam = searchParams.get("year");

    const participants = await prisma.participant.findMany({
      where: { isExcluded: false },
      orderBy: { name: "asc" },
    });

    const allSessions = await prisma.meetingSession.findMany({
      orderBy: { date: "desc" },
      include: { attendances: true },
    });

    const filteredSessions = allSessions.filter((s) => {
      const d = new Date(s.date);
      const mMatch = !monthParam || monthParam === "ALL" || (d.getMonth() + 1).toString() === monthParam;
      const yMatch = !yearParam || yearParam === "ALL" || d.getFullYear().toString() === yearParam;
      return mMatch && yMatch;
    });

    const totalSessionsCount = filteredSessions.length;
    const now = new Date();

    const headers = [
      "No",
      "Nama Peserta",
      "Kelas",
      "No. WhatsApp",
      "Total Sesi",
      "Hadir (GPS)",
      "Izin / Sakit",
      "Tidak Hadir (Alpa)",
      "Persentase Kehadiran (%)",
    ];

    const rows = participants.map((p, idx) => {
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
          alpaCount++;
        }
      });

      const percentage = totalSessionsCount > 0
        ? Math.round((hadirCount / totalSessionsCount) * 100)
        : 0;

      return [
        idx + 1,
        `"${p.name || "Tanpa Nama"}"`,
        `"${p.studentClass || "-"}"`,
        `"+${p.phoneNumber}"`,
        totalSessionsCount,
        hadirCount,
        izinCount,
        alpaCount,
        `"${percentage}%"`,
      ].join(",");
    });

    const csvContent = "\uFEFF" + [headers.join(","), ...rows].join("\n");
    const filename = `Laporan_Kumulatif_Velocity_${monthParam || "ALL"}_${yearParam || "ALL"}.csv`;

    return new NextResponse(csvContent, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error: any) {
    console.error("GET /api/reports/cumulative/export error:", error);
    return NextResponse.json(
      { error: "Gagal mengekspor laporan kumulatif CSV" },
      { status: 500 }
    );
  }
}
