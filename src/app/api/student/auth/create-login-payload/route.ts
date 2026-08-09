import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import crypto from "crypto";

export async function GET() {
  try {
    const payloadId = "AUTH_" + crypto.randomBytes(12).toString("hex");
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    await prisma.systemSetting.create({
      data: {
        key: `login_payload:${payloadId}`,
        value: JSON.stringify({
          payloadId,
          status: "PENDING",
          participantId: null,
          expiresAt: expiresAt.toISOString(),
        }),
      },
    });

    // Get WhatsApp bot phone number if available
    let botPhoneNumber = "";
    try {
      const phoneSetting = await prisma.systemSetting.findUnique({
        where: { key: "bot_phone_number" },
      });
      if (phoneSetting && phoneSetting.value) {
        botPhoneNumber = phoneSetting.value.trim();
      } else {
        const botStatusSetting = await prisma.systemSetting.findUnique({
          where: { key: "bot_user_id" },
        });
        if (botStatusSetting && botStatusSetting.value) {
          botPhoneNumber = botStatusSetting.value.split("@")[0].split(":")[0];
        }
      }
    } catch (e) {}

    const defaultCommand = `!login ${payloadId}`;
    const waLink = botPhoneNumber
      ? `https://wa.me/${botPhoneNumber}?text=${encodeURIComponent(defaultCommand)}`
      : `https://wa.me/?text=${encodeURIComponent(defaultCommand)}`;

    return NextResponse.json({
      success: true,
      payloadId,
      commandText: defaultCommand,
      waLink,
    });
  } catch (err: any) {
    console.error("[CreateLoginPayload] Error:", err);
    return NextResponse.json(
      { success: false, error: "Gagal membuat sesi login WhatsApp." },
      { status: 500 }
    );
  }
}
