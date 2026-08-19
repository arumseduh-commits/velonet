import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import crypto from "crypto";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const origin = url.origin;

    if (origin && !origin.includes("localhost")) {
      await prisma.systemSetting.upsert({
        where: { key: "app_base_url" },
        create: { key: "app_base_url", value: origin },
        update: { value: origin },
      }).catch(() => {});
    }

    const payloadId = "REG_" + crypto.randomBytes(12).toString("hex");
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

    const defaultCommand = `Halo VeloBot, i want to register with code ${payloadId}`;
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
    console.error("[CreateRegisterPayload] Error:", err);
    return NextResponse.json(
      { success: false, error: "Gagal membuat sesi registrasi WhatsApp." },
      { status: 500 }
    );
  }
}
