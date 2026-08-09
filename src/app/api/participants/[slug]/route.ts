import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { slugify } from "@/lib/slug";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const resolvedParams = await params;
    const slug = resolvedParams.slug;

    if (!slug) {
      return NextResponse.json(
        { success: false, error: "Slug parameters required." },
        { status: 400 }
      );
    }

    const cleanNum = slug.replace(/\D/g, "");

    const allParticipants = await prisma.participant.findMany();

    // Match by ID, exact phoneNumber, cleanNum, or slugified name
    const participant = allParticipants.find((p) => {
      if (p.id === slug) return true;
      if (p.phoneNumber === slug || p.phoneNumber === cleanNum) return true;
      if (p.name && slugify(p.name) === slug) return true;
      return false;
    });

    if (!participant) {
      return NextResponse.json(
        { success: false, error: `Peserta dengan ID/Slug "${slug}" tidak ditemukan.` },
        { status: 404 }
      );
    }

    // Fetch all meeting sessions to build participant's attendance history
    const allSessions = await prisma.meetingSession.findMany({
      orderBy: { date: "desc" },
      include: {
        attendances: true,
      },
    });

    const now = new Date();
    let hadirCount = 0;
    let izinCount = 0;
    let alpaCount = 0;

    const attendanceHistory = allSessions.map((s) => {
      const att = s.attendances.find((a) => a.participantId === participant.id);
      const isClosed = now > new Date(s.endTime) || s.isCancelled;

      let status = att?.status || "BELUM_ABSEN";
      if (!att && isClosed) {
        status = "ALPA";
      }

      if (status === "HADIR") hadirCount++;
      else if (status === "IZIN" || status === "SAKIT") izinCount++;
      else if (status === "ALPA") alpaCount++;

      return {
        sessionId: s.id,
        sessionTitle: s.title,
        sessionDate: s.date,
        startTime: s.startTime,
        endTime: s.endTime,
        locationName: s.locationName,
        isCancelled: s.isCancelled,
        status,
        checkInTime: att?.checkInTime || null,
        distanceMeter: att?.distanceMeter ?? null,
        method: att?.method || null,
        notes: att?.notes || (status === "ALPA" && !att ? "Tidak hadir (Melewati jam absensi)" : null),
      };
    });

    const totalSessions = allSessions.length;
    const percentage = totalSessions > 0
      ? Math.round((hadirCount / totalSessions) * 100)
      : 0;

    return NextResponse.json({
      success: true,
      data: participant,
      attendanceHistory,
      stats: {
        totalSessions,
        hadirCount,
        izinCount,
        alpaCount,
        percentage,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Gagal mengambil data peserta." },
      { status: 500 }
    );
  }
}
