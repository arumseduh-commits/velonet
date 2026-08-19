import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createStudentSession } from "@/lib/student-auth";

function normalizePhoneNumber(input: string): string {
  let cleaned = input.replace(/\D/g, "");
  if (cleaned.startsWith("0")) {
    cleaned = "62" + cleaned.slice(1);
  }
  return cleaned;
}

export async function POST(req: Request) {
  try {
    const { phoneNumber, otpCode } = await req.json();

    if (!phoneNumber || !otpCode) {
      return NextResponse.json(
        { success: false, error: "Nomor WhatsApp dan Kode OTP wajib diisi." },
        { status: 400 }
      );
    }

    const normalizedPhone = normalizePhoneNumber(phoneNumber);

    const participant = await prisma.user.findUnique({
      where: { phoneNumber: normalizedPhone },
    });

    if (!participant || participant.isExcluded) {
      return NextResponse.json(
        { success: false, error: "Peserta tidak ditemukan." },
        { status: 404 }
      );
    }

    // Find the active OTP verification record
    const otpRecord = await prisma.otpVerification.findFirst({
      where: {
        userId: participant.id,
        isUsed: false,
        expiresAt: { gte: new Date() },
      },
      orderBy: { createdAt: "desc" },
    });

    if (!otpRecord) {
      return NextResponse.json(
        {
          success: false,
          error: "Kode OTP telah kadaluwarsa atau belum diminta. Silakan minta OTP baru.",
        },
        { status: 400 }
      );
    }

    // Check attempts limit
    if (otpRecord.attempts >= 5) {
      await prisma.otpVerification.update({
        where: { id: otpRecord.id },
        data: { isUsed: true },
      });
      return NextResponse.json(
        {
          success: false,
          error: "Batas percobaan OTP telah terlampaui. Silakan minta OTP baru.",
        },
        { status: 400 }
      );
    }

    // Increment attempt counter
    await prisma.otpVerification.update({
      where: { id: otpRecord.id },
      data: { attempts: otpRecord.attempts + 1 },
    });

    if (otpRecord.otpCode.trim() !== otpCode.trim()) {
      return NextResponse.json(
        {
          success: false,
          error: "Kode OTP salah. Periksa kembali chat WhatsApp Anda.",
        },
        { status: 400 }
      );
    }

    // Mark OTP as used
    await prisma.otpVerification.update({
      where: { id: otpRecord.id },
      data: { isUsed: true },
    });

    // Create session and set cookie
    const userAgent = req.headers.get("user-agent") || undefined;
    await createStudentSession(participant.id, userAgent);

    return NextResponse.json({
      success: true,
      message: "Login siswa berhasil!",
      redirectUrl: "/student",
    });
  } catch (err: any) {
    console.error("[VerifyOTP] Error:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Terjadi kesalahan server." },
      { status: 500 }
    );
  }
}
