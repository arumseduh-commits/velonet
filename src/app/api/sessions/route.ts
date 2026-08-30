import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const pageParam = searchParams.get("page");
    const limitParam = searchParams.get("limit");
    const query = searchParams.get("query") || "";

    const page = Math.max(1, parseInt(pageParam || "1", 10) || 1);
    const isAll = limitParam === "ALL";
    const limit = isAll ? undefined : (parseInt(limitParam || "", 10) || 10);

    const whereClause: any = {};
    if (query) {
      whereClause.OR = [
        { title: { contains: query, mode: "insensitive" } },
        { locationName: { contains: query, mode: "insensitive" } },
      ];
    }

    const [total, sessions] = await prisma.$transaction([
      prisma.meetingSession.count({ where: whereClause }),
      prisma.meetingSession.findMany({
        where: whereClause,
        orderBy: { createdAt: "desc" },
        ...(limit && !isAll ? { take: limit, skip: (page - 1) * limit } : {}),
        include: {
          attendances: {
            select: {
              id: true,
              status: true,
            },
          },
        },
      }),
    ]);

    const formatted = sessions.map((s) => {
      const hadirCount = s.attendances.filter((a) => a.status === "HADIR").length;
      const izinCount = s.attendances.filter((a) => a.status === "IZIN" || a.status === "SAKIT").length;

      return {
        ...s,
        hadirCount,
        izinCount,
      };
    });

    const totalPages = isAll || !limit ? 1 : Math.ceil(total / limit) || 1;

    return NextResponse.json({
      success: true,
      data: formatted,
      pagination: {
        total,
        page: isAll ? 1 : page,
        limit: isAll ? "ALL" : (limit || total),
        totalPages,
        hasNext: !isAll && page < totalPages,
        hasPrev: !isAll && page > 1,
      },
    });
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
