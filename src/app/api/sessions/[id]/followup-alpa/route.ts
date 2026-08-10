import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { botEngine } from "@/lib/bot-engine";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    let customNote = "";

    try {
      const body = await req.json();
      if (body.customNote) {
        customNote = body.customNote;
      }
    } catch (e) {
      // Body empty or invalid JSON, ignore
    }

    const session = await prisma.meetingSession.findUnique({
      where: { id },
      include: {
        attendances: true,
      },
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
    const allParticipants = await prisma.participant.findMany({
      where: {
        isExcluded: false,
        status: "COMPLETED",
      },
    });

    const attendanceMap = new Map(
      session.attendances.map((a) => [a.participantId, a])
    );

    // Filter participants who are ALPA (no attendance record or status == ALPA)
    const alpaParticipants = allParticipants.filter((p) => {
      const att = attendanceMap.get(p.id);
      if (!att) return true; // No check-in record
      return att.status === "ALPA";
    });

    if (alpaParticipants.length === 0) {
      return NextResponse.json(
        { error: "Tidak ada peserta dengan status ALPA untuk sesi ini." },
        { status: 400 }
      );
    }

    const dateStr = new Date(session.date).toLocaleDateString("id-ID", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    });

    let successCount = 0;
    let failCount = 0;

    // Start background task
    (async () => {
      botEngine.emit("log", `Memulai pengiriman follow-up ALPA sesi "${session.title}" ke ${alpaParticipants.length} peserta...`);
      for (const p of alpaParticipants) {
        const msg = `🔴 *PEMBERITAHUAN KEHADIRAN VELOCITY*\n\nHalo Kak *${
          p.name || "Peserta"
        }*,\n\nAnda tercatat *TIDAK HADIR (ALPA)* pada sesi pertemuan *"${
          session.title
        }"* (${dateStr}).\n\n${
          customNote ? `📝 *Catatan Pembina:*\n${customNote}\n\n` : ""
        }📝 *Petunjuk Izin Absensi:*\nJika kelak Kakak berhalangan hadir pada pertemuan berikutnya, silakan gunakan format *!ijin [alasan]* ke bot ini.\n*Contoh:* \`!ijin izin karena ada acara kondangan\`\n\n_Terima kasih atas perhatian dan kerjasamanya!_`;

        try {
          const sent = await botEngine.sendMessage(p.phoneNumber, msg);
          if (sent) {
            successCount++;
          } else {
            failCount++;
          }
        } catch (e) {
          failCount++;
        }
        
        // Delay 10-16s between messages to prevent spam detection
        const delay = Math.floor(Math.random() * 6000) + 10000;
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
      botEngine.emit("log", `✅ Selesai kirim follow-up ALPA sesi "${session.title}". Sukses: ${successCount}, Gagal: ${failCount}`);
    })().catch(err => {
      console.error("Follow-up ALPA background task error:", err);
    });

    return NextResponse.json({
      success: true,
      message: "Notifikasi ALPA sedang dikirim di latar belakang.",
      total: alpaParticipants.length,
    });
  } catch (error: any) {
    console.error("POST /api/sessions/[id]/followup-alpa error:", error);
    return NextResponse.json(
      { error: "Gagal mengirimkan follow-up notifikasi ke peserta Alpa" },
      { status: 500 }
    );
  }
}
