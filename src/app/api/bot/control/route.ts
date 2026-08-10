import { NextRequest, NextResponse } from "next/server";
import { botEngine } from "@/lib/bot-engine";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action, phoneNumber } = body;

    if (action === "start") {
      // Non-blocking start
      botEngine.startBot().catch((err) => {
        console.error("Async start error:", err);
      });
      return NextResponse.json({
        success: true,
        message: "Bot start process triggered.",
        status: botEngine.getStatus(),
      });
    }

    if (action === "request_pairing_code") {
      if (!phoneNumber) {
        return NextResponse.json(
          { success: false, error: "Nomor WhatsApp wajib diisi." },
          { status: 400 }
        );
      }

      const pairingCode = await botEngine.requestPairingCode(phoneNumber);
      return NextResponse.json({
        success: true,
        pairingCode,
        message: `Kode Pasangan berhasil dibuat: ${pairingCode}`,
      });
    }

    if (action === "logout") {
      await botEngine.logoutBot();
      return NextResponse.json({
        success: true,
        message: "Bot session logged out successfully.",
        status: botEngine.getStatus(),
      });
    }

    if (action === "status") {
      return NextResponse.json({
        success: true,
        status: botEngine.getStatus(),
      });
    }

    return NextResponse.json(
      { success: false, error: "Invalid action specified." },
      { status: 400 }
    );
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to control bot." },
      { status: 500 }
    );
  }
}
