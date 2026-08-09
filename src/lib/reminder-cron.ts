import { prisma } from "./prisma";
import { botEngine } from "./bot-engine";
import { RegistrationStatus } from "./bot-state-machine";

export interface ReminderRunResult {
  totalProcessed: number;
  sentCount: number;
  failedCount: number;
  skippedCount: number;
  details: string[];
}

/**
 * Scans participants with status WAITING_CONFIRMATION or NOT_STARTED (where isExcluded = false)
 * and re-sends the confirmation reminder message if eligible.
 */
export async function runReminderBatch(
  cooldownHours: number = 24
): Promise<ReminderRunResult> {
  const cutoffDate = new Date(Date.now() - cooldownHours * 60 * 60 * 1000);

  const pendingParticipants = await prisma.participant.findMany({
    where: {
      status: {
        in: [RegistrationStatus.NOT_STARTED, RegistrationStatus.WAITING_CONFIRMATION],
      },
      isExcluded: false,
      OR: [
        { lastSentAt: null },
        { lastSentAt: { lte: cutoffDate } },
      ],
    },
  });

  const result: ReminderRunResult = {
    totalProcessed: pendingParticipants.length,
    sentCount: 0,
    failedCount: 0,
    skippedCount: 0,
    details: [],
  };

  const status = botEngine.getStatus();
  if (status.state !== "CONNECTED") {
    result.details.push("Reminder aborted: WhatsApp Bot is currently DISCONNECTED.");
    return result;
  }

  const reminderMsg =
    "⏰ *Pengingat Konfirmasi Ekskul Velocity*\n\nHalo! Kami belum menerima konfirmasi kamu.\n\nApakah kamu masih ingin melanjutkan pelatihan ekskul Bahasa Inggris di komunitas Velocity?\n\nBalas *YA* jika ingin lanjut, atau *TIDAK* jika tidak ingin melanjutkan.";

  for (const participant of pendingParticipants) {
    try {
      const sent = await botEngine.sendMessage(participant.phoneNumber, reminderMsg);
      if (sent) {
        await prisma.participant.update({
          where: { id: participant.id },
          data: {
            lastSentAt: new Date(),
            status: RegistrationStatus.WAITING_CONFIRMATION,
          },
        });
        result.sentCount++;
        result.details.push(`Sent reminder to ${participant.phoneNumber}`);
      } else {
        result.failedCount++;
        result.details.push(`Failed to send reminder to ${participant.phoneNumber}`);
      }
    } catch (err: any) {
      result.failedCount++;
      result.details.push(`Error for ${participant.phoneNumber}: ${err.message}`);
    }
  }

  return result;
}
