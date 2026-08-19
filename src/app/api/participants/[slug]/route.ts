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
    const rawSlug = resolvedParams?.slug;

    if (!rawSlug) {
      return NextResponse.json(
        { success: false, error: "Parameter ID/Slug peserta wajib diisi." },
        { status: 400 }
      );
    }

    const decodedSlug = decodeURIComponent(rawSlug).trim();
    const cleanNum = decodedSlug.replace(/\D/g, "");
    const formatted62 = cleanNum.startsWith("0") ? "62" + cleanNum.slice(1) : cleanNum;

    // Direct search by ID, exact phoneNumber, clean phone number, or formatted 62 number
    let participant = await prisma.user.findFirst({
      where: {
        OR: [
          { id: decodedSlug },
          { phoneNumber: decodedSlug },
          ...(cleanNum ? [{ phoneNumber: cleanNum }] : []),
          ...(formatted62 ? [{ phoneNumber: formatted62 }] : []),
          { name: { equals: decodedSlug, mode: "insensitive" } },
        ],
      },
    });

    // Fallback: search by slugified name if not found by direct match
    if (!participant) {
      const allUsers = await prisma.user.findMany({
        select: { id: true, name: true, phoneNumber: true },
      });
      const matched = allUsers.find(
        (u) => u.name && slugify(u.name) === slugify(decodedSlug)
      );
      if (matched) {
        participant = await prisma.user.findUnique({ where: { id: matched.id } });
      }
    }

    if (!participant) {
      return NextResponse.json(
        { success: false, error: `Peserta dengan ID/Slug "${decodedSlug}" tidak ditemukan.` },
        { status: 404 }
      );
    }

    // Fetch all meeting sessions to build participant's attendance history
    let allSessions: any[] = [];
    try {
      allSessions = await prisma.meetingSession.findMany({
        orderBy: { date: "desc" },
        include: {
          attendances: true,
        },
      });
    } catch (sessionErr) {
      console.error("[ParticipantDetailAPI] Error fetching sessions:", sessionErr);
      allSessions = [];
    }

    const now = new Date();
    let hadirCount = 0;
    let izinCount = 0;
    let alpaCount = 0;

    const attendanceHistory = (allSessions || []).map((s) => {
      const att = s.attendances?.find((a: any) => a.userId === participant!.id);
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
    console.error("[ParticipantDetailAPI] Fatal Error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Gagal mengambil data peserta." },
      { status: 500 }
    );
  }
}
