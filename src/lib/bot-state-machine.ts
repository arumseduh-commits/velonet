import crypto from "crypto";
import { PrismaClient } from "@prisma/client";
import { processLocationCheckIn, processLeaveRequest } from "./attendance";

export interface LocationPayload {
  latitude: number;
  longitude: number;
  messageTimestamp?: number;
  isForwarded?: boolean;
}

export const RegistrationStatus = {
  NOT_STARTED: "NOT_STARTED",
  WAITING_CONFIRMATION: "WAITING_CONFIRMATION",
  WAITING_NAME: "WAITING_NAME",
  WAITING_CLASS: "WAITING_CLASS",
  WAITING_MOTIVATION: "WAITING_MOTIVATION",
  WAITING_HOBBY: "WAITING_HOBBY",
  COMPLETED: "COMPLETED",
  OPTED_OUT: "OPTED_OUT",
} as const;

export type RegistrationStatusType =
  (typeof RegistrationStatus)[keyof typeof RegistrationStatus];

export interface StateMachineResult {
  replyMessage: string | null;
  newStatus: RegistrationStatusType;
}

/**
 * Normalizes any phone number into international format without leading '+' or spaces.
 * Example: '08123456789' -> '628123456789'
 */
export function normalizePhoneNumber(raw: string): string {
  let cleaned = raw.replace(/\D/g, "");
  if (cleaned.startsWith("0")) {
    cleaned = "62" + cleaned.slice(1);
  }
  return cleaned;
}

/**
 * Handles incoming text & location messages and manages participant registration state machine & attendance.
 * STRICT RULE: Only responds to participants ALREADY registered in the database by Admin.
 * Unknown users who chat the bot are SILENTLY IGNORED (no reply sent).
 */
export async function processIncomingMessage(
  prisma: PrismaClient,
  rawSenderJid: string,
  messageText: string,
  pushName?: string,
  realPhoneNum?: string,
  locationData?: LocationPayload
): Promise<StateMachineResult | null> {
  const cleanJid = rawSenderJid.split("@")[0].split(":")[0];
  const incomingNum = normalizePhoneNumber(cleanJid);

  // Find participant by LID number OR real phone number
  let participant = await prisma.participant.findFirst({
    where: {
      OR: [
        { phoneNumber: incomingNum },
        ...(realPhoneNum ? [{ phoneNumber: normalizePhoneNumber(realPhoneNum) }] : []),
      ],
    },
  });

  // Fallback: If not found and incoming JID is LID, search by pushName or latest participant
  if (!participant && rawSenderJid.endsWith("@lid")) {
    if (pushName && pushName.trim().length > 2) {
      participant = await prisma.participant.findFirst({
        where: {
          name: { contains: pushName.trim(), mode: "insensitive" },
          isExcluded: false,
        },
        orderBy: { updatedAt: "desc" },
      });
    }

    if (!participant) {
      participant = await prisma.participant.findFirst({
        where: { isExcluded: false },
        orderBy: { updatedAt: "desc" },
      });
    }
  }

  // STRICT RULE: If participant is NOT in the database, DO NOT REPLY!
  if (!participant) {
    return null;
  }

  // Auto-upgrade participant's phoneNumber to REAL Phone Number if we now have realPhoneNum
  if (realPhoneNum && realPhoneNum !== participant.phoneNumber) {
    const formattedRealNum = normalizePhoneNumber(realPhoneNum);
    if (formattedRealNum.startsWith("62")) {
      const existingReal = await prisma.participant.findUnique({
        where: { phoneNumber: formattedRealNum },
      });

      if (existingReal && existingReal.id !== participant.id) {
        // Merge current LID participant into existing real phone number participant
        const merged = await prisma.participant.update({
          where: { id: existingReal.id },
          data: {
            name: participant.name || pushName || existingReal.name || null,
            studentClass: participant.studentClass || existingReal.studentClass || null,
            motivation: participant.motivation || existingReal.motivation || null,
            hobby: participant.hobby || existingReal.hobby || null,
            status: participant.status !== RegistrationStatus.NOT_STARTED ? participant.status : existingReal.status,
          },
        });
        try {
          await prisma.participant.delete({ where: { id: participant.id } });
        } catch (e) {}
        participant = merged;
      } else {
        try {
          participant = await prisma.participant.update({
            where: { id: participant.id },
            data: {
              phoneNumber: formattedRealNum,
              name: participant.name || pushName || null,
            },
          });
        } catch (e) {}
      }
    }
  } else if (pushName && !participant.name) {
    try {
      participant = await prisma.participant.update({
        where: { id: participant.id },
        data: { name: pushName },
      });
    } catch (e) {}
  }

  // If excluded, do not respond automatically
  if (participant.isExcluded) {
    return null;
  }

  // 1. Handle GPS Location Check-In
  if (locationData) {
    const checkInResult = await processLocationCheckIn({
      prisma,
      participantId: participant.id,
      latitude: locationData.latitude,
      longitude: locationData.longitude,
      messageTimestamp: locationData.messageTimestamp,
      isForwarded: locationData.isForwarded,
    });

    return {
      newStatus: participant.status as RegistrationStatusType,
      replyMessage: checkInResult.replyMessage,
    };
  }

  const text = messageText.trim();
  const lowerText = text.toLowerCase();

  // Check if participant has a pending leave session choice selection (e.g. user replied '1' or '2')
  try {
    const pendingSetting = await prisma.systemSetting.findUnique({
      where: { key: `leave_pending:${participant.id}` },
    });

    if (pendingSetting) {
      const pendingData = JSON.parse(pendingSetting.value);
      // If setting is less than 1 hour old and text contains choice numbers (e.g., '1', '2', '1,2')
      if (pendingData && Date.now() - pendingData.timestamp < 3600000) {
        const numbers = text.match(/\d+/g);
        if (numbers && numbers.length > 0) {
          const selectedChoices = numbers.map((n) => parseInt(n, 10));
          const matchedSessions = pendingData.sessions.filter((s: any) =>
            selectedChoices.includes(s.choice)
          );

          if (matchedSessions.length > 0) {
            await prisma.systemSetting.delete({
              where: { key: `leave_pending:${participant.id}` },
            });

            const processedTitles: string[] = [];
            for (const sess of matchedSessions) {
              await processLeaveRequest(
                prisma,
                participant.id,
                pendingData.type || "IZIN",
                pendingData.notes || "",
                sess.id
              );
              processedTitles.push(sess.title);
            }

            return {
              newStatus: participant.status as RegistrationStatusType,
              replyMessage: `🟡 *PENGAJUAN ${pendingData.type || "IZIN"} DICATAT*\n\n📌 *Sesi Terpilih:* ${processedTitles.join(
                ", "
              )}\n👤 *Nama:* ${participant.name || "Peserta"}\n📝 *Keterangan:* ${
                pendingData.notes || "-"
              }\n\nTerima kasih atas konfirmasinya!`,
            };
          }
        }
      } else {
        await prisma.systemSetting.delete({
          where: { key: `leave_pending:${participant.id}` },
        });
      }
    }
  } catch (e) {
    console.error("Error processing pending leave choice:", e);
  }

  // 1.5 Handle Instant Web Login Command (!login / login / !auth)
  if (
    lowerText === "!login" ||
    lowerText === "login" ||
    lowerText.startsWith("!login ") ||
    lowerText.startsWith("login ") ||
    lowerText.startsWith("!auth") ||
    lowerText.startsWith("auth")
  ) {
    if (participant.status !== RegistrationStatus.COMPLETED || participant.isExcluded) {
      return {
        newStatus: participant.status as RegistrationStatusType,
        replyMessage: `🔴 *AKUN BELUM TERDAFTAR DI GRUP VELOCITY*\n\nNomor WhatsApp Anda (+${participant.phoneNumber}) belum terdaftar atau belum bergabung di Grup WhatsApp Komunitas Velocity.\n\nSilakan bergabung ke grup WhatsApp Velocity atau ikuti pendaftaran via WA terlebih dahulu dengan membalas *YA* pada chat ini.`,
      };
    }

    // Extract payloadId if provided (e.g., "!login AUTH_e8f92a10b4c7_984102")
    const matchPayload = text.match(/AUTH_[a-f0-9]+/i);
    if (matchPayload && matchPayload[0]) {
      const payloadId = matchPayload[0];
      try {
        const payloadSetting = await prisma.systemSetting.findUnique({
          where: { key: `login_payload:${payloadId}` },
        });

        if (payloadSetting) {
          const payloadData = JSON.parse(payloadSetting.value);
          if (payloadData && payloadData.status === "PENDING") {
            await prisma.systemSetting.update({
              where: { key: `login_payload:${payloadId}` },
              data: {
                value: JSON.stringify({
                  ...payloadData,
                  status: "VERIFIED",
                  participantId: participant.id,
                  verifiedAt: new Date().toISOString(),
                }),
              },
            });
          }
        }
      } catch (err) {
        console.error("Error updating temp login payload:", err);
      }
    }

    const magicToken = crypto.randomBytes(32).toString("hex");
    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    await prisma.otpVerification.updateMany({
      where: { participantId: participant.id, isUsed: false },
      data: { isUsed: true },
    });

    await prisma.otpVerification.create({
      data: {
        participantId: participant.id,
        phoneNumber: participant.phoneNumber,
        otpCode,
        magicToken,
        expiresAt,
      },
    });

    let baseUrl = "http://localhost:3000";
    try {
      const setting = await prisma.systemSetting.findUnique({
        where: { key: "app_base_url" },
      });
      if (setting && setting.value) baseUrl = setting.value;
    } catch (e) {}

    const directLoginUrl = `${baseUrl}/api/student/auth/verify-magic?token=${magicToken}`;

    return {
      newStatus: participant.status as RegistrationStatusType,
      replyMessage: `🔓 *LINK PORTAL SISWA VELOCITY*\n\nHalo Kak *${
        participant.name || "Peserta"
      }*!\n\nKlik link di bawah ini untuk *LANGSUNG MASUK* ke akun Portal Siswa Anda tanpa perlu mengetik password:\n\n🔗 ${directLoginUrl}\n\n_⚠️ Link ini berlaku 10 menit. Selamat belajar! 🚀_`,
    };
  }

  // 2. Handle Leave / Sick Requests (!izin / !sakit)
  if (
    lowerText.startsWith("!izin") ||
    lowerText.startsWith("!sakit") ||
    lowerText.startsWith("izin ") ||
    lowerText.startsWith("sakit ")
  ) {
    const isSakit = lowerText.startsWith("!sakit") || lowerText.startsWith("sakit ");
    const type = isSakit ? "SAKIT" : "IZIN";
    const notes = text.replace(/^(!izin|!sakit|izin|sakit)\s*/i, "").trim();

    const leaveResult = await processLeaveRequest(
      prisma,
      participant.id,
      type,
      notes
    );

    return {
      newStatus: participant.status as RegistrationStatusType,
      replyMessage: leaveResult.replyMessage,
    };
  }

  const upperText = text.toUpperCase();

  switch (participant.status) {
    case RegistrationStatus.NOT_STARTED:
    case RegistrationStatus.WAITING_CONFIRMATION: {
      if (
        upperText === "YA" ||
        upperText === "Y" ||
        upperText === "YES" ||
        upperText === "IYA"
      ) {
        await prisma.participant.update({
          where: { id: participant.id },
          data: { status: RegistrationStatus.WAITING_NAME },
        });
        return {
          newStatus: RegistrationStatus.WAITING_NAME,
          replyMessage:
            "Terima kasih atas konfirmasinya! 👍\n\nSilakan jawab pertanyaan 1 dari 4:\n*Siapa nama lengkap kamu?*",
        };
      } else if (
        upperText === "TIDAK" ||
        upperText === "N" ||
        upperText === "NO" ||
        upperText === "GA" ||
        upperText === "GAK" ||
        upperText === "ENGGAK"
      ) {
        await prisma.participant.update({
          where: { id: participant.id },
          data: { status: RegistrationStatus.OPTED_OUT },
        });
        return {
          newStatus: RegistrationStatus.OPTED_OUT,
          replyMessage:
            "Baik, terima kasih atas konfirmasinya. Data kamu telah dicatat.",
        };
      } else {
        return {
          newStatus: participant.status as RegistrationStatusType,
          replyMessage:
            "Halo! Silakan konfirmasi terlebih dahulu:\n\nApakah kamu masih ingin melanjutkan pelatihan ekskul Bahasa Inggris di komunitas Velocity?\n\nBalas *YA* untuk lanjut, atau *TIDAK* untuk keluar.",
        };
      }
    }

    case RegistrationStatus.WAITING_NAME: {
      await prisma.participant.update({
        where: { id: participant.id },
        data: {
          name: text,
          status: RegistrationStatus.WAITING_CLASS,
        },
      });
      return {
        newStatus: RegistrationStatus.WAITING_CLASS,
        replyMessage: `Terima kasih, ${text}!\n\nPertanyaan 2 dari 4:\n*Kamu dari kelas berapa?* (Contoh: X IPA 1 / XI IPS 2)`,
      };
    }

    case RegistrationStatus.WAITING_CLASS: {
      await prisma.participant.update({
        where: { id: participant.id },
        data: {
          studentClass: text,
          status: RegistrationStatus.WAITING_MOTIVATION,
        },
      });
      return {
        newStatus: RegistrationStatus.WAITING_MOTIVATION,
        replyMessage:
          "Pertanyaan 3 dari 4:\n*Apa motivasi/kemauan kamu untuk mempelajari bahasa Inggris?*",
      };
    }

    case RegistrationStatus.WAITING_MOTIVATION: {
      await prisma.participant.update({
        where: { id: participant.id },
        data: {
          motivation: text,
          status: RegistrationStatus.WAITING_HOBBY,
        },
      });
      return {
        newStatus: RegistrationStatus.WAITING_HOBBY,
        replyMessage: "Pertanyaan 4 dari 4 (Terakhir):\n*Apa hobi kamu?*",
      };
    }

    case RegistrationStatus.WAITING_HOBBY: {
      const updated = await prisma.participant.update({
        where: { id: participant.id },
        data: {
          hobby: text,
          status: RegistrationStatus.COMPLETED,
        },
      });
      return {
        newStatus: RegistrationStatus.COMPLETED,
        replyMessage: `🎉 Terima kasih! Data pendaftaran ekskul Bahasa Inggris Velocity kamu telah berhasil disimpan.\n\n*Detail Data Kamu:*\n• Nama: ${updated.name || "-"}\n• Kelas: ${updated.studentClass || "-"}\n• Motivasi: ${updated.motivation || "-"}\n• Hobi: ${updated.hobby || "-"}\n\nSampai jumpa di kelas Velocity! 🚀`,
      };
    }

    case RegistrationStatus.COMPLETED: {
      const cleanLower = text.toLowerCase().trim().replace(/^[.\s/!\\]+/, "");
      if (
        cleanLower.includes("tiket") ||
        cleanLower.includes("ticket") ||
        cleanLower.includes("status") ||
        cleanLower.includes("help") ||
        cleanLower.includes("bantuan") ||
        cleanLower.includes("jid") ||
        cleanLower.includes("info")
      ) {
        return {
          newStatus: RegistrationStatus.COMPLETED,
          replyMessage: `🎫 *BUKTI TIKET PENDAFTARAN VELOCITY* 🎫\n\n• Nama: ${participant.name || "-"}\n• Kelas: ${participant.studentClass || "-"}\n• Status: ✅ COMPLETED (Terdaftar)\n• No. WA: +${participant.phoneNumber}\n• Motivasi: ${participant.motivation || "-"}\n• Hobi: ${participant.hobby || "-"}\n\n_Pendaftaran kamu sudah terverifikasi di sistem Velocity._\nJika ada pertanyaan untuk admin manusia, silakan tulis pesan kamu di bawah ini.`,
        };
      }
      // SILENT MODE FOR COMPLETED USERS:
      // Return null so the bot does NOT send any auto-reply when user chats human admin!
      return null;
    }

    case RegistrationStatus.OPTED_OUT: {
      const cleanUpper = upperText.replace(/^\./, "");
      if (cleanUpper === "DAFTAR" || cleanUpper === "RESET" || cleanUpper === "TIKET") {
        await prisma.participant.update({
          where: { id: participant.id },
          data: { status: RegistrationStatus.WAITING_CONFIRMATION },
        });
        return {
          newStatus: RegistrationStatus.WAITING_CONFIRMATION,
          replyMessage:
            "Sistem telah mereset status kamu. Silakan konfirmasi:\nApakah kamu ingin mendaftar ke komunitas Velocity?\n\nBalas *YA* untuk mendaftar.",
        };
      }
      // SILENT MODE FOR OPTED_OUT USERS:
      return null;
    }

    default:
      return null;
  }
}
