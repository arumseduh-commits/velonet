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
      startIso,
      endIso,
      dateIso,
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

    // Convert inputs to exact Date objects
    let sessionDate: Date;
    let startDateTime: Date;
    let endDateTime: Date;

    if (startIso && endIso) {
      sessionDate = dateIso ? new Date(dateIso) : new Date(`${date}T00:00:00.000Z`);
      startDateTime = new Date(startIso);
      endDateTime = new Date(endIso);
    } else {
      // Robust fallback: Parse in WIB (+07:00) context
      const [year, month, day] = date.split("-").map(Number);
      const [startH, startM] = startTime.split(":").map(Number);
      const [endH, endM] = endTime.split(":").map(Number);

      sessionDate = new Date(Date.UTC(year, month - 1, day, 0, 0, 0));
      startDateTime = new Date(Date.UTC(year, month - 1, day, startH - 7, startM, 0));

      // Handle overnight session where end time crosses midnight (e.g. 23:00 - 01:00)
      const isOvernight = endH < startH || (endH === startH && endM <= startM);
      const endDay = isOvernight ? day + 1 : day;
      endDateTime = new Date(Date.UTC(year, month - 1, endDay, endH - 7, endM, 0));
    }

    const newSession = await prisma.meetingSession.create({
      data: {
        title,
        date: sessionDate,
        startTime: startDateTime,
        endTime: endDateTime,
        locationName: locationName || null,
        latitude: latitude != null && latitude !== "" ? parseFloat(latitude) : null,
        longitude: longitude != null && longitude !== "" ? parseFloat(longitude) : null,
        radiusMeter: radiusMeter != null && radiusMeter !== "" ? parseFloat(radiusMeter) : 50,
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
