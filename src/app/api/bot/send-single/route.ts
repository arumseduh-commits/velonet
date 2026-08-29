import { NextRequest, NextResponse } from "next/server";
import { botEngine } from "@/lib/bot-engine";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { phoneNumber, message, templateType, userId } = body;

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

    const cleanNum = phoneNumber.replace(/\D/g, "");
    const formattedNum = cleanNum.startsWith("0") ? "62" + cleanNum.slice(1) : cleanNum;

    // Find participant
    let participant = null;
    if (userId) {
      participant = await prisma.user.findUnique({ where: { id: userId } });
    }
    if (!participant) {
      participant = await prisma.user.findFirst({
        where: {
          OR: [{ phoneNumber: formattedNum }, { phoneNumber: cleanNum }],
        },
      });
    }

    const sent = await botEngine.sendMessage(phoneNumber, message);

    if (!sent) {
      return NextResponse.json(
        { success: false, error: `Gagal mengirim pesan WhatsApp ke +${phoneNumber}. Periksa nomor HP atau jaringan bot.` },
        { status: 400 }
      );
    }

    if (participant) {
      // Update lastSentAt
      await prisma.user.update({
        where: { id: participant.id },
        data: { lastSentAt: new Date() },
      }).catch(() => {});

      // If templateType is NAME_CONFIRMATION, initialize name confirmation state
      if (templateType === "NAME_CONFIRMATION") {
        await prisma.systemSetting.upsert({
          where: { key: `name_confirm_pending:${participant.id}` },
          create: {
            key: `name_confirm_pending:${participant.id}`,
            value: JSON.stringify({
              timestamp: Date.now(),
              currentName: participant.name,
              phoneNumber: participant.phoneNumber,
            }),
          },
          update: {
            value: JSON.stringify({
              timestamp: Date.now(),
              currentName: participant.name,
              phoneNumber: participant.phoneNumber,
            }),
          },
        });
      }

      // If templateType is FACE_REMINDER, initialize face reminder state
      if (templateType === "FACE_REMINDER") {
        await prisma.systemSetting.upsert({
          where: { key: `face_reminder_pending:${participant.id}` },
          create: {
            key: `face_reminder_pending:${participant.id}`,
            value: JSON.stringify({
              timestamp: Date.now(),
              name: participant.name,
              phoneNumber: participant.phoneNumber,
            }),
          },
          update: {
            value: JSON.stringify({
              timestamp: Date.now(),
              name: participant.name,
              phoneNumber: participant.phoneNumber,
            }),
          },
        });
      }
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
