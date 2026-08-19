import { PrismaClient } from "@prisma/client";

/**
 * Calculates the Great Circle distance (Haversine formula) between two GPS points in meters.
 */
export function calculateHaversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371e3; // Earth radius in meters
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // Distance in meters
}

export async function getActiveMeetingSession(prisma: PrismaClient) {
  const now = new Date();

  const sessions = await prisma.meetingSession.findMany({
    where: {
      isActive: true,
      isCancelled: false,
    },
    orderBy: { date: "desc" },
  });

  if (sessions.length === 0) return null;

  // Filter for sessions where current time is within start and end time window on the session date
  const currentSession = sessions.find((s) => {
    const start = new Date(s.startTime);
    const end = new Date(s.endTime);
    return now >= start && now <= end;
  });

  // If no session is currently open right now, return null
  return currentSession || null;
}

export interface LocationCheckInParams {
  prisma: PrismaClient;
  userId: string;
  latitude: number;
  longitude: number;
  messageTimestamp?: number; // Unix timestamp in seconds
  isForwarded?: boolean;
}

/**
 * Processes incoming GPS location message for attendance check-in.
 */
export async function processLocationCheckIn({
  prisma,
  userId,
  latitude,
  longitude,
  messageTimestamp,
  isForwarded,
}: LocationCheckInParams): Promise<{ success: boolean; replyMessage: string }> {
  // 1. Fetch User info
  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user) {
    return {
      success: false,
      replyMessage: "🔴 Data Anda tidak ditemukan di database. Hubungi Admin.",
    };
  }

  // 2. Fetch active session
  const session = await getActiveMeetingSession(prisma);
  if (!session) {
    return {
      success: false,
      replyMessage:
        "🔴 *ABSENSI GAGAL*\n\nTidak ada Sesi Pertemuan Velocity yang sedang aktif saat ini. Absensi hanya dapat dilakukan sesuai jadwal kumpul.",
    };
  }

  // 2a. Check if session is cancelled
  if (session.isCancelled) {
    return {
      success: false,
      replyMessage: `🔴 *SESI DIBATALKAN*\n\nMaaf, sesi pertemuan "${session.title}" telah DIBATALKAN oleh Admin. Absensi tidak dapat dilakukan.`,
    };
  }

  // 2b. Check if session hasn't started or is already closed
  const nowTime = new Date();
  const startTime = new Date(session.startTime);
  const endTime = new Date(session.endTime);

  if (nowTime < startTime) {
    const startTimeStr = startTime.toLocaleTimeString("id-ID", {
      hour: "2-digit",
      minute: "2-digit",
    });
    return {
      success: false,
      replyMessage: `⏳ *ABSENSI BELUM DIBUKA*\n\nAbsensi untuk sesi "${session.title}" baru akan DIBUKA pada pukul *${startTimeStr} WIB*. Mohon lakukan absensi saat sesi sudah dimulai.`,
    };
  }

  if (nowTime > endTime) {
    const endTimeStr = endTime.toLocaleTimeString("id-ID", {
      hour: "2-digit",
      minute: "2-digit",
    });
    return {
      success: false,
      replyMessage: `🔴 *ABSENSI TELAH DITUTUP*\n\nSesi absensi untuk "${session.title}" telah DITUTUP pada pukul *${endTimeStr} WIB*.`,
    };
  }

  // 3. Anti-Forwarding Check
  if (isForwarded) {
    return {
      success: false,
      replyMessage:
        "🔴 *ABSENSI GAGAL*\n\nPesan lokasi terusan (*Forwarded*) tidak diperbolehkan untuk absensi. Mohon kirimkan lokasi asli langsung dari HP Anda.",
    };
  }

  // 4. Timestamp Freshness Check (Max 3 minutes old)
  if (messageTimestamp) {
    const nowSec = Math.floor(Date.now() / 1000);
    const diffSec = Math.abs(nowSec - messageTimestamp);
    if (diffSec > 180) { // More than 3 minutes old
      return {
        success: false,
        replyMessage:
          "🔴 *ABSENSI GAGAL*\n\nTitik lokasi yang Anda kirim sudah kedaluwarsa atau merupakan pesan lama. Mohon kirimkan lokasi terkini Anda.",
      };
    }
  }

  // 5. Calculate Distance if session has target GPS coordinates
  let distanceMeter: number | null = null;
  if (session.latitude != null && session.longitude != null) {
    distanceMeter = calculateHaversineDistance(
      latitude,
      longitude,
      session.latitude,
      session.longitude
    );

    if (distanceMeter > session.radiusMeter) {
      return {
        success: false,
        replyMessage: `🔴 *ABSENSI GAGAL (DI LUAR AREA)*\n\nLokasi Anda terdeteksi berjarak *${Math.round(
          distanceMeter
        )} meter* dari titik kumpul (Maksimal: ${
          session.radiusMeter
        } meter).\n\nMohon lakukan absensi saat Anda sudah berada di lokasi perkumpulan.`,
      };
    }
  }

  // 6. Save Attendance to Database
  const now = new Date();
  const timeStr = now.toLocaleTimeString("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
  });

  await prisma.attendance.upsert({
    where: {
      sessionId_userId: {
        sessionId: session.id,
        userId: user.id,
      },
    },
    create: {
      sessionId: session.id,
      userId: user.id,
      status: "HADIR",
      method: "LOCATION_GPS",
      latitude,
      longitude,
      distanceMeter: distanceMeter != null ? Math.round(distanceMeter) : null,
      checkInTime: now,
    },
    update: {
      status: "HADIR",
      method: "LOCATION_GPS",
      latitude,
      longitude,
      distanceMeter: distanceMeter != null ? Math.round(distanceMeter) : null,
      checkInTime: now,
    },
  });

  const distText = distanceMeter != null ? `${Math.round(distanceMeter)} Meter` : "Tervalidasi";

  return {
    success: true,
    replyMessage: `🟢 *ABSENSI BERHASIL*\n\n📌 *Sesi:* ${session.title}\n👤 *Nama:* ${
      user.name || "Peserta"
    }\n🏫 *Kelas:* ${user.studentClass || "-"}\n⏰ *Waktu:* ${timeStr} WIB\n📍 *Jarak:* ${distText} (Di Lokasi)\n\nTerima kasih, selamat mengikuti pertemuan Velocity! 🚀`,
  };
}

export async function getTodayMeetingSessions(prisma: PrismaClient) {
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
  const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

  return await prisma.meetingSession.findMany({
    where: {
      isActive: true,
      isCancelled: false,
      date: {
        gte: startOfDay,
        lte: endOfDay,
      },
    },
    orderBy: { startTime: "asc" },
  });
}

/**
 * Processes incoming leave / sick request via text message (e.g., "!izin Ada acara keluarga").
 */
export async function processLeaveRequest(
  prisma: PrismaClient,
  userId: string,
  type: "IZIN" | "SAKIT",
  notes: string,
  targetSessionId?: string
): Promise<{ success: boolean; replyMessage: string }> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user) {
    return {
      success: false,
      replyMessage: "🔴 Data Anda tidak ditemukan.",
    };
  }

  // 1. If targetSessionId is explicitly provided (user responded with choice number)
  if (targetSessionId) {
    const session = await prisma.meetingSession.findUnique({
      where: { id: targetSessionId },
    });
    if (!session) {
      return { success: false, replyMessage: "🔴 Sesi pertemuan tidak ditemukan." };
    }

    await prisma.attendance.upsert({
      where: {
        sessionId_userId: {
          sessionId: session.id,
          userId: user.id,
        },
      },
      create: {
        sessionId: session.id,
        userId: user.id,
        status: type,
        method: "TEXT_MESSAGE",
        notes: notes || `Pengajuan ${type} via WhatsApp`,
      },
      update: {
        status: type,
        notes: notes || `Pengajuan ${type} via WhatsApp`,
      },
    });

    return {
      success: true,
      replyMessage: `🟡 *PENGAJUAN ${type} DICATAT*\n\n📌 *Sesi:* ${session.title}\n👤 *Nama:* ${
        user.name || "Peserta"
      }\n📝 *Keterangan:* ${notes || "-"}\n\nTerima kasih atas informasinya!`,
    };
  }

  // 2. Fetch all scheduled/active sessions for today
  const todaySessions = await getTodayMeetingSessions(prisma);

  if (todaySessions.length === 0) {
    // Fallback: check currently active session
    const activeSession = await getActiveMeetingSession(prisma);
    if (!activeSession) {
      return {
        success: false,
        replyMessage: "🔴 Tidak ada Sesi Pertemuan yang sedang aktif atau dijadwalkan hari ini.",
      };
    }
    todaySessions.push(activeSession);
  }

  // Single session scheduled today
  if (todaySessions.length === 1) {
    const session = todaySessions[0];
    await prisma.attendance.upsert({
      where: {
        sessionId_userId: {
          sessionId: session.id,
          userId: user.id,
        },
      },
      create: {
        sessionId: session.id,
        userId: user.id,
        status: type,
        method: "TEXT_MESSAGE",
        notes: notes || `Pengajuan ${type} via WhatsApp`,
      },
      update: {
        status: type,
        notes: notes || `Pengajuan ${type} via WhatsApp`,
      },
    });

    return {
      success: true,
      replyMessage: `🟡 *PENGAJUAN ${type} DICATAT*\n\n📌 *Sesi:* ${session.title}\n👤 *Nama:* ${
        user.name || "Peserta"
      }\n📝 *Keterangan:* ${notes || "-"}\n\nTerima kasih atas informasinya!`,
    };
  }

  // Multiple sessions today (2 or 3 classes/sessions scheduled)
  // Save pending state in SystemSetting table for user choice
  const sessionListPayload = todaySessions.map((s, idx) => ({
    choice: idx + 1,
    id: s.id,
    title: s.title,
    time: new Date(s.startTime).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }),
  }));

  await prisma.systemSetting.upsert({
    where: { key: `leave_pending:${user.id}` },
    create: {
      key: `leave_pending:${user.id}`,
      value: JSON.stringify({
        type,
        notes,
        sessions: sessionListPayload,
        timestamp: Date.now(),
      }),
    },
    update: {
      value: JSON.stringify({
        type,
        notes,
        sessions: sessionListPayload,
        timestamp: Date.now(),
      }),
    },
  });

  const sessionOptionsText = sessionListPayload
    .map((s) => `${s.choice}️⃣ *${s.title}* (${s.time} WIB)`)
    .join("\n");

  return {
    success: true,
    replyMessage: `📌 *PILIH SESI PERTEMUAN UNTUK IZIN:*\n\nAda *${todaySessions.length} Sesi Pertemuan* yang dijadwalkan hari ini. Silakan balas dengan **ANGKA** nomor sesi yang ingin Kakak izinkan:\n\n${sessionOptionsText}\n\n_Balas dengan angka *1*${todaySessions.length > 1 ? `, *2*` : ''}${todaySessions.length > 2 ? `, *3*` : ''} untuk mengonfirmasi pilihan izin Kakak._`,
  };
}
