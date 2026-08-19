import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const now = new Date();

    const openSessions = await prisma.meetingSession.findMany({
      where: {
        isActive: true,
        isCancelled: false,
        startTime: { lte: now },
        endTime: { gte: now },
      },
      orderBy: { startTime: "asc" },
      select: {
        id: true,
        title: true,
        locationName: true,
        latitude: true,
        longitude: true,
        radiusMeter: true,
        startTime: true,
        endTime: true,
      },
    });

    return NextResponse.json({
      success: true,
      data: openSessions,
    });
  } catch (err: any) {
    console.error("[ActiveLocationsAPI] Error:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Gagal mengambil data lokasi aktif." },
      { status: 500 }
    );
  }
}
