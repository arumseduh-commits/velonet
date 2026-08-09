import { NextRequest, NextResponse } from "next/server";
import { botEngine } from "@/lib/bot-engine";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { phoneNumber, message } = body;

    if (!phoneNumber || !message) {
      return NextResponse.json(
        { success: false, error: "Nomor WhatsApp dan isi pesan wajib diisi." },
        { status: 400 }
      );
    }

    const botStatus = botEngine.getStatus();
    if (botStatus.state !== "CONNECTED") {
      return NextResponse.json(
        { success: false, error: "Bot WhatsApp sedang tidak terhubung. Sambungkan bot terlebih dahulu di Dashboard Bot." },
        { status: 400 }
      );
    }

    const sent = await botEngine.sendMessage(phoneNumber, message);

    if (!sent) {
      return NextResponse.json(
        { success: false, error: `Gagal mengirim pesan WhatsApp ke +${phoneNumber}. Periksa nomor HP atau jaringan bot.` },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `Pesan WhatsApp berhasil dikirim ke +${phoneNumber}`,
    });
  } catch (error: any) {
    console.error("POST /api/bot/send-single error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Gagal mengirim pesan WhatsApp." },
      { status: 500 }
    );
  }
}
