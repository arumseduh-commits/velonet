import { prisma } from "./prisma";
import { botEngine } from "./bot-engine";

let isSchedulerRunning = false;

/**
 * Native 24/7 Background Cron Scheduler for VeloNet.
 * Automatically checks time every minute and executes scheduled automated tasks
 * WITHOUT requiring the Admin to open the web application.
 */
export function startAutoCronScheduler() {
  if (isSchedulerRunning) return;
  isSchedulerRunning = true;

  console.log("[AutoCronScheduler] Native 24/7 background scheduler started.");

  // Run initial check upon boot
  checkAndRunNightlyReminders();

  // Check every 60 seconds (1 minute)
  setInterval(async () => {
    try {
      await checkAndRunNightlyReminders();
    } catch (err) {
      console.error("[AutoCronScheduler] Error running background tasks:", err);
    }
  }, 60000);
}

/**
 * Automated Nightly Task (Runs automatically at 22:00 / 10 PM every night)
 * Checks if there is a meeting session scheduled for TOMORROW.
 * If found, automatically sends H-1 WA reminder to all active students.
 */
export async function checkAndRunNightlyReminders() {
  const now = new Date();
  const currentHour = now.getHours();
  const currentMinute = now.getMinutes();

  // Default target time: 22:00 (10 PM)
  let targetHour = 22;
  try {
    const setting = await prisma.systemSetting.findUnique({
      where: { key: "cron_reminder_hour" },
    });
    if (setting && setting.value) {
      targetHour = parseInt(setting.value, 10);
    }
  } catch (e) {}

  // Only execute during target hour (e.g. 22:00 - 22:05)
  if (currentHour !== targetHour) {
    return;
  }

  const todayDateStr = now.toISOString().split("T")[0];
  const settingKey = `cron_run:tomorrow_reminder:${todayDateStr}`;

  // Check if already executed today
  try {
    const alreadyRun = await prisma.systemSetting.findUnique({
      where: { key: settingKey },
    });
    if (alreadyRun) {
      return; // Already executed tonight
    }
  } catch (e) {}

  // Check if bot is connected
  const botStatus = botEngine.getStatus();
  if (botStatus.state !== "CONNECTED") {
    console.warn("[AutoCronScheduler] Bot is DISCONNECTED. Skipping nightly reminder.");
    return;
  }

  // Calculate Tomorrow date range
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const tomorrowStart = new Date(tomorrow.getFullYear(), tomorrow.getMonth(), tomorrow.getDate(), 0, 0, 0, 0);
  const tomorrowEnd = new Date(tomorrow.getFullYear(), tomorrow.getMonth(), tomorrow.getDate(), 23, 59, 59, 999);

  // Fetch sessions scheduled for tomorrow
  const tomorrowSessions = await prisma.meetingSession.findMany({
    where: {
      isActive: true,
      isCancelled: false,
      date: {
        gte: tomorrowStart,
        lte: tomorrowEnd,
      },
    },
    orderBy: { startTime: "asc" },
  });

  if (tomorrowSessions.length === 0) {
    console.log("[AutoCronScheduler] No meeting sessions scheduled for tomorrow. Cron finished.");
    // Record that cron ran for today
    await recordCronRun(settingKey, "No sessions tomorrow");
    return;
  }

  console.log(`[AutoCronScheduler] Found ${tomorrowSessions.length} session(s) scheduled for tomorrow. Initiating automatic WA reminders...`);

  // Fetch all active participants
  const participants = await prisma.participant.findMany({
    where: {
      isExcluded: false,
      status: "COMPLETED",
    },
  });

  if (participants.length === 0) {
    await recordCronRun(settingKey, "No active participants");
    return;
  }

  let totalSent = 0;

  for (const session of tomorrowSessions) {
    const dateFormatted = new Date(session.date).toLocaleDateString("id-ID", {
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

    for (const p of participants) {
      const msg = `⏰ *PENGINGAT PERTEMUAN VELOCITY BESOK*\n\nHalo Kak *${
        p.name || "Peserta"
      }*,\n\nSekadar mengingatkan bahwa *BESOK* ada sesi pertemuan ekskul Bahasa Inggris Velocity:\n\n📌 *Sesi:* ${
        session.title
      }\n📅 *Hari/Tanggal:* ${dateFormatted}\n⏰ *Jam Absen:* ${startTimeStr} - ${endTimeStr} WIB\n📍 *Lokasi:* ${
        session.locationName || "Ruang Kumpul Velocity"
      }\n\n*Petunjuk Absensi:* Saat sudah berada di lokasi kumpul sebelum jam ditutup, cukup kirimkan *Share Location* WhatsApp Kakak ke chat bot ini.\n\n_Sampai jumpa besok sore! 🚀_`;

      const sent = await botEngine.sendMessage(p.phoneNumber, msg);
      if (sent) totalSent++;

      // Small delay between sends to avoid rate limiting
      await new Promise((resolve) => setTimeout(resolve, 800));
    }
  }

  await recordCronRun(settingKey, `Sent ${totalSent} reminders for ${tomorrowSessions.length} sessions`);
  console.log(`[AutoCronScheduler] Nightly reminder completed. Total messages sent: ${totalSent}`);
}

async function recordCronRun(key: string, details: string) {
  try {
    await prisma.systemSetting.upsert({
      where: { key },
      create: {
        key,
        value: JSON.stringify({
          executedAt: new Date().toISOString(),
          details,
        }),
      },
      update: {
        value: JSON.stringify({
          executedAt: new Date().toISOString(),
          details,
        }),
      },
    });
  } catch (e) {}
}
