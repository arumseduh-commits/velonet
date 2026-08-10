import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { botEngine } from "@/lib/bot-engine";
import { buildSessionBroadcastMessage } from "@/lib/message-variations";


export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const session = await prisma.meetingSession.findUnique({
      where: { id },
    });

    if (!session) {
      return NextResponse.json(
        { error: "Sesi pertemuan tidak ditemukan" },
        { status: 404 }
      );
    }

    const botStatus = botEngine.getStatus();
    if (botStatus.state !== "CONNECTED") {
      return NextResponse.json(
        { error: "Bot WhatsApp sedang tidak terhubung. Sambungkan bot terlebih dahulu di Dashboard Bot." },
        { status: 400 }
      );
    }

    // Fetch all active completed participants
    const participants = await prisma.participant.findMany({
      where: {
        isExcluded: false,
        status: "COMPLETED",
      },
    });

    if (participants.length === 0) {
      return NextResponse.json(
        { error: "Tidak ada peserta terdaftar dengan status COMPLETED." },
        { status: 400 }
      );
    }

    let customMessagePayload: string | undefined;
    let isCancellationNotice = false;

    try {
      const body = await req.json();
      if (body.customMessage !== undefined) {
        customMessagePayload = body.customMessage;
        // Save to DB
        await prisma.meetingSession.update({
          where: { id },
          data: { customMessage: body.customMessage },
        });
      }
      if (body.isCancellationNotice) {
        isCancellationNotice = true;
      }
    } catch (e) {
      // Body empty or invalid JSON, ignore
    }

    const activeCustomMessage = customMessagePayload ?? session.customMessage ?? "";

    const dateStr = new Date(session.date).toLocaleDateString("id-ID", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    });

    const startTimeStr = new Date(session.startTime).toLocaleTimeString("id-ID", {
      hour: "2-digit",
      minute: "2-digit",
    });

    const endTimeStr = new Date(session.endTime).toLocaleTimeString("id-ID", {
      hour: "2-digit",
      minute: "2-digit",
    });

    let successCount = 0;
    let failCount = 0;

    // Start background task
    (async () => {
      botEngine.emit("log", `Memulai broadcast pengumuman sesi "${session.title}" ke ${participants.length} peserta...`);
      for (const p of participants) {
        try {
          // Each participant gets a slightly UNIQUE variation of the message
          const msg = buildSessionBroadcastMessage({
            name: p.name || "Peserta",
            sessionTitle: session.title,
            dateStr,
            startTimeStr,
            endTimeStr,
            locationName: session.locationName || "Lokasi Kumpul Velocity",
            customMessage: activeCustomMessage || undefined,
            isCancellation: session.isCancelled || isCancellationNotice,
          });

          const sent = await botEngine.sendMessage(p.phoneNumber, msg);
          if (sent) {
            successCount++;
          } else {
            failCount++;
          }
        } catch (e) {
          failCount++;
        }
        
        // Wait 10-16 seconds between messages to prevent spam detection
        const delay = Math.floor(Math.random() * 6000) + 10000; 
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
      botEngine.emit("log", `✅ Selesai broadcast sesi "${session.title}". Sukses: ${successCount}, Gagal: ${failCount}`);
    })().catch(err => {
      console.error("Broadcast background task error:", err);
    });


    return NextResponse.json({
      success: true,
      message: "Broadcast sedang diproses di latar belakang.",
      total: participants.length,
    });
  } catch (error: any) {
    console.error("POST /api/sessions/[id]/broadcast error:", error);
    return NextResponse.json(
      { error: "Gagal mengirimkan broadcast pengumuman sesi" },
      { status: 500 }
    );
  }
}
