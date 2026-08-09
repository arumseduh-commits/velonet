import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { botEngine } from "@/lib/bot-engine";

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

    for (const p of participants) {
      let msg = "";
      if (session.isCancelled || isCancellationNotice) {
        msg = `🔴 *PEMBERITAHUAN PEMBATALAN PERTEMUAN VELOCITY*\n\nHalo Kak *${
          p.name || "Peserta"
        }*,\n\nMohon maaf, sesi pertemuan *"${
          session.title
        }"* yang dijadwalkan pada *${dateStr}* di *${
          session.locationName || "Titik Kumpul"
        }* telah *DIBATALKAN* oleh Admin.\n\n${
          activeCustomMessage ? `📝 *Alasan/Catatan Admin:*\n${activeCustomMessage}\n\n` : ""
        }_Terima kasih dan mohon maaf atas ketidaknyamanannya._`;
      } else {
        msg = `📢 *PENGUMUMAN PERTEMUAN VELOCITY*\n\nHalo Kak *${
          p.name || "Peserta"
        }*,\n\n📌 *Sesi:* ${
          session.title
        }\n📅 *Hari/Tanggal:* ${dateStr}\n⏰ *Jam Buka Absen:* ${startTimeStr} WIB\n⌛ *Jam Ditutup Absen:* ${endTimeStr} WIB (Ditutup Otomatis)\n📍 *Lokasi:* ${
          session.locationName || "Lokasi Kumpul Velocity"
        }\n${
          activeCustomMessage ? `\n📝 *Catatan Khusus Admin:*\n${activeCustomMessage}\n` : ""
        }\n*Petunjuk Absensi:* Saat berada di lokasi perkumpulan sebelum jam ${endTimeStr} WIB, cukup kirimkan *Share Location* WhatsApp Anda ke chat bot ini.\n\n_Jika berhalangan hadir, balas dengan format: *!izin [alasan]*_`;
      }

      const sent = await botEngine.sendMessage(p.phoneNumber, msg);
      if (sent) {
        successCount++;
      } else {
        failCount++;
      }
      // Small delay between sends to avoid rate limiting
      await new Promise((resolve) => setTimeout(resolve, 800));
    }

    return NextResponse.json({
      success: true,
      total: participants.length,
      successCount,
      failCount,
    });
  } catch (error: any) {
    console.error("POST /api/sessions/[id]/broadcast error:", error);
    return NextResponse.json(
      { error: "Gagal mengirimkan broadcast pengumuman sesi" },
      { status: 500 }
    );
  }
}
