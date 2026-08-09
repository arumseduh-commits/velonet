import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const session = await prisma.meetingSession.findUnique({
      where: { id },
      include: {
        attendances: {
          include: {
            participant: true,
          },
        },
      },
    });

    if (!session) {
      return NextResponse.json(
        { error: "Sesi pertemuan tidak ditemukan" },
        { status: 404 }
      );
    }

    const allParticipants = await prisma.participant.findMany({
      where: { isExcluded: false },
      orderBy: { name: "asc" },
    });

    const attendanceMap = new Map(
      session.attendances.map((a) => [a.participantId, a])
    );

    // Build CSV Header
    const headers = [
      "No",
      "Nama",
      "No. WhatsApp",
      "Kelas",
      "Status Kehadiran",
      "Jam Absen",
      "Metode Absen",
      "Jarak (Meter)",
      "Catatan/Keterangan",
    ];

    const rows = allParticipants.map((p, index) => {
      const att = attendanceMap.get(p.id);
      const statusStr = att ? att.status : "BELUM ABSEN";
      const timeStr = att?.checkInTime
        ? new Date(att.checkInTime).toLocaleTimeString("id-ID", {
            hour: "2-digit",
            minute: "2-digit",
          })
        : "-";
      const methodStr = att?.method || "-";
      const distStr = att?.distanceMeter != null ? `${att.distanceMeter}m` : "-";
      const notesStr = att?.notes || "-";

      return [
        index + 1,
        `"${p.name || "Tanpa Nama"}"`,
        `"${p.phoneNumber}"`,
        `"${p.studentClass || "-"}"`,
        `"${statusStr}"`,
        `"${timeStr}"`,
        `"${methodStr}"`,
        `"${distStr}"`,
        `"${notesStr}"`,
      ].join(",");
    });

    const csvContent = "\uFEFF" + [headers.join(","), ...rows].join("\n");

    const sanitizedTitle = session.title.replace(/[^a-zA-Z0-9_-]/g, "_");
    const filename = `Absensi_${sanitizedTitle}_${new Date().toISOString().split("T")[0]}.csv`;

    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error: any) {
    console.error("GET /api/sessions/[id]/export error:", error);
    return NextResponse.json(
      { error: "Gagal meng-export rekap absensi" },
      { status: 500 }
    );
  }
}
