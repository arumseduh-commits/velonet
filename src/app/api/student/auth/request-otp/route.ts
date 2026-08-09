import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { botEngine } from "@/lib/bot-engine";
import { generateOtpCode, generateMagicToken } from "@/lib/student-auth";

function normalizePhoneNumber(input: string): string {
  let cleaned = input.replace(/\D/g, "");
  if (cleaned.startsWith("0")) {
    cleaned = "62" + cleaned.slice(1);
  }
  return cleaned;
}

export async function POST(req: Request) {
  try {
    const { phoneNumber } = await req.json();

    if (!phoneNumber || typeof phoneNumber !== "string") {
      return NextResponse.json(
        { success: false, error: "Nomor WhatsApp wajib diisi." },
        { status: 400 }
      );
    }

    const normalizedPhone = normalizePhoneNumber(phoneNumber);

    // Search for registered participant
    const participant = await prisma.participant.findUnique({
      where: { phoneNumber: normalizedPhone },
    });

    if (!participant || participant.isExcluded) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Nomor WhatsApp belum terdaftar di Komunitas Velocity. Silakan daftarkan diri Anda via WhatsApp terlebih dahulu.",
        },
        { status: 404 }
      );
    }

    if (participant.status !== "COMPLETED") {
      return NextResponse.json(
        {
          success: false,
          error:
            "Pendaftaran Anda di WhatsApp belum selesai. Silakan selesaikan pengisian nama & kelas di WhatsApp sebelum login ke web.",
        },
        { status: 400 }
      );
    }

    // Inactivate any previous unused OTPs for this participant
    await prisma.otpVerification.updateMany({
      where: {
        participantId: participant.id,
        isUsed: false,
      },
      data: { isUsed: true },
    });

    const otpCode = generateOtpCode();
    const magicToken = generateMagicToken();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes expiry

    await prisma.otpVerification.create({
      data: {
        participantId: participant.id,
        phoneNumber: normalizedPhone,
        otpCode,
        magicToken,
        expiresAt,
      },
    });

    // Determine host origin for Magic Link URL
    const url = new URL(req.url);
    const origin = url.origin;

    const botStatus = botEngine.getStatus();
    if (botStatus.state !== "CONNECTED") {
      return NextResponse.json(
        {
          success: false,
          error:
            "WhatsApp Bot sedang offline. Hubungi Pembina untuk menyambungkan bot.",
        },
        { status: 503 }
      );
    }

    const message = `🔐 *KODE OTP & LINK LOGIN PORTAL VELONET*\n\nHalo Kak *${
      participant.name || "Peserta"
    }*!\n\nBerikut adalah kode OTP verifikasi Anda untuk masuk ke Portal Siswa Velocity:\n\n👉 *${otpCode}*\n\nAtau klik Link Login Otomatis (Magic Link) berikut:\n🔗 ${origin}/api/student/auth/verify-magic?token=${magicToken}\n\n⚠️ *Penting*: Kode OTP & Link ini berlaku selama 10 menit. Jangan bagikan kode ini kepada siapa pun.`;

    const sent = await botEngine.sendMessage(normalizedPhone, message);

    if (!sent) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Gagal mengirim pesan OTP ke WhatsApp Anda. Pastikan nomor terhubung dengan WhatsApp.",
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `Kode OTP 6-Digit telah dikirimkan ke WhatsApp +${normalizedPhone}.`,
    });
  } catch (err: any) {
    console.error("[RequestOTP] Error:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Terjadi kesalahan server." },
      { status: 500 }
    );
  }
}
