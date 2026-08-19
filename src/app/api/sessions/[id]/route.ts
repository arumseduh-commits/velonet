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
            user: true,
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

    // Fetch all active completed/registered participants
    const allParticipants = await prisma.user.findMany({
      where: {
        isExcluded: false,
      },
      orderBy: { name: "asc" },
    });

    const attendanceMap = new Map(
      session.attendances.map((a) => [a.userId, a])
    );

    const now = new Date();
    const isPastSession = now > new Date(session.endTime) || session.isCancelled;

    const mergedList = allParticipants.map((p) => {
      const att = attendanceMap.get(p.id);
      let calculatedStatus = att?.status || "BELUM_ABSEN";

      // If session end time has passed and participant didn't check in, classify as ALPA (Tidak Hadir)
      if (!att && isPastSession) {
        calculatedStatus = "ALPA";
      }

      return {
        participantId: p.id,
        name: p.name || "Tanpa Nama",
        phoneNumber: p.phoneNumber,
        studentClass: p.studentClass || "-",
        registrationStatus: p.status,
        attendanceId: att?.id || null,
        status: calculatedStatus,
        method: att?.method || null,
        checkInTime: att?.checkInTime || null,
        distanceMeter: att?.distanceMeter ?? null,
        notes: att?.notes || (calculatedStatus === "ALPA" && !att ? "Tidak hadir (Melewati jam absensi)" : null),
      };
    });

    return NextResponse.json({
      session,
      participants: mergedList,
    });
  } catch (error: any) {
    console.error("GET /api/sessions/[id] error:", error);
    return NextResponse.json(
      { error: "Gagal mengambil detail sesi pertemuan" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();

    const updated = await prisma.meetingSession.update({
      where: { id },
      data: body,
    });

    return NextResponse.json(updated);
  } catch (error: any) {
    console.error("PATCH /api/sessions/[id] error:", error);
    return NextResponse.json(
      { error: "Gagal memperbarui sesi pertemuan" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    await prisma.meetingSession.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("DELETE /api/sessions/[id] error:", error);
    return NextResponse.json(
      { error: "Gagal menghapus sesi pertemuan" },
      { status: 500 }
    );
  }
}
