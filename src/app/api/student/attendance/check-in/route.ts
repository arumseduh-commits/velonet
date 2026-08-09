import { NextResponse } from "next/server";
import { getLoggedInStudent } from "@/lib/student-auth";
import { processLocationCheckIn } from "@/lib/attendance";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  try {
    const student = await getLoggedInStudent();

    if (!student) {
      return NextResponse.json(
        { success: false, error: "Unauthorized. Silakan login terlebih dahulu." },
        { status: 401 }
      );
    }

    const { latitude, longitude } = await req.json();

    if (typeof latitude !== "number" || typeof longitude !== "number") {
      return NextResponse.json(
        { success: false, error: "Koordinat GPS tidak valid." },
        { status: 400 }
      );
    }

    const checkInResult = await processLocationCheckIn({
      prisma,
      participantId: student.id,
      latitude,
      longitude,
    });

    if (checkInResult.success) {
      return NextResponse.json({
        success: true,
        message: checkInResult.replyMessage.replace(/\*/g, ""),
      });
    } else {
      return NextResponse.json({
        success: false,
        error: checkInResult.replyMessage.replace(/\*/g, ""),
      });
    }
  } catch (err: any) {
    console.error("[StudentWebCheckIn] Error:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Terjadi kesalahan server." },
      { status: 500 }
    );
  }
}
