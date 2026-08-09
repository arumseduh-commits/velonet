import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const sessions = await prisma.meetingSession.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        attendances: {
          select: {
            id: true,
            status: true,
          },
        },
      },
    });

    const formatted = sessions.map((s) => {
      const hadirCount = s.attendances.filter((a) => a.status === "HADIR").length;
      const izinCount = s.attendances.filter((a) => a.status === "IZIN" || a.status === "SAKIT").length;

      return {
        ...s,
        hadirCount,
        izinCount,
      };
    });

    return NextResponse.json(formatted);
  } catch (error: any) {
    console.error("GET /api/sessions error:", error);
    return NextResponse.json(
      { error: "Gagal mengambil daftar sesi pertemuan" },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      title,
      date,
      startTime,
      endTime,
      locationName,
      latitude,
      longitude,
      radiusMeter,
    } = body;

    if (!title || !date || !startTime || !endTime) {
      return NextResponse.json(
        { error: "Judul, tanggal, jam mulai, dan jam selesai wajib diisi" },
        { status: 400 }
      );
    }

    // Convert inputs to Date objects
    const sessionDate = new Date(date);
    const startDateTime = new Date(`${date}T${startTime}`);
    const endDateTime = new Date(`${date}T${endTime}`);

    const newSession = await prisma.meetingSession.create({
      data: {
        title,
        date: sessionDate,
        startTime: startDateTime,
        endTime: endDateTime,
        locationName: locationName || null,
        latitude: latitude != null && latitude !== "" ? parseFloat(latitude) : null,
        longitude: longitude != null && longitude !== "" ? parseFloat(longitude) : null,
        radiusMeter: radiusMeter != null && radiusMeter !== "" ? parseFloat(radiusMeter) : 150,
        isActive: true,
      },
    });

    return NextResponse.json(newSession, { status: 201 });
  } catch (error: any) {
    console.error("POST /api/sessions error:", error);
    return NextResponse.json(
      { error: error.message || "Gagal membuat sesi pertemuan" },
      { status: 500 }
    );
  }
}
