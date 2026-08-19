import { NextResponse } from "next/server";
import { getLoggedInStudent } from "@/lib/student-auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const student = await getLoggedInStudent();

    if (!student) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Get attendance stats for student
    const attendances = await prisma.attendance.findMany({
      where: { userId: student.id },
      include: { session: true },
      orderBy: { createdAt: "desc" },
    });

    const totalSessions = await prisma.meetingSession.count({
      where: { isActive: true },
    });

    const hadirCount = attendances.filter((a) => a.status === "HADIR").length;
    const izinCount = attendances.filter((a) => a.status === "IZIN" || a.status === "SAKIT").length;
    const alpaCount = attendances.filter((a) => a.status === "ALPA").length;

    const ratePercentage = totalSessions > 0 ? Math.round((hadirCount / totalSessions) * 100) : 0;

    let currentPhone = student.phoneNumber;
    // Auto-heal if phoneNumber is an LID
    const isLid = currentPhone.length > 14 || (!currentPhone.startsWith("62") && !currentPhone.startsWith("08"));
    if (isLid) {
      try {
        const { botEngine } = await import("@/lib/bot-engine");
        const resolved = await botEngine.resolveLidToRealPhone(currentPhone);
        if (resolved && (resolved.startsWith("62") || resolved.startsWith("08"))) {
          currentPhone = resolved;
          await prisma.user.update({
            where: { id: student.id },
            data: { phoneNumber: currentPhone },
          }).catch(() => {});
        }
      } catch (e) {}
    }

    return NextResponse.json({
      success: true,
      data: {
        student: {
          id: student.id,
          name: student.name || "",
          phoneNumber: currentPhone,
          studentClass: student.studentClass || "",
          motivation: student.motivation || "",
          hobby: student.hobby || "",
          gender: student.gender || "",
          status: student.status,
          isFaceRegistered: Boolean(student.faceDescriptor),
          facePhoto: student.facePhoto || null,
          faceRegisteredAt: student.faceRegisteredAt || null,
        },

        stats: {
          totalSessions,
          hadirCount,
          izinCount,
          alpaCount,
          ratePercentage,
        },
        recentAttendances: attendances.map((a) => ({
          id: a.id,
          sessionTitle: a.session.title,
          sessionDate: a.session.date,
          status: a.status,
          method: a.method,
          checkInTime: a.checkInTime,
          distanceMeter: a.distanceMeter,
          notes: a.notes,
        })),
      },
    });
  } catch (err: any) {
    console.error("[StudentMe] Error:", err);
    return NextResponse.json(
      { success: false, error: "Terjadi kesalahan server." },
      { status: 500 }
    );
  }
}
