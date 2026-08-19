import crypto from "crypto";
import { PrismaClient } from "@prisma/client";
import { processLocationCheckIn, processLeaveRequest } from "./attendance";
import { buildRegistrationMessage } from "./message-variations";


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
  locationData?: LocationPayload,
  checkGroup?: (phoneNumber: string) => Promise<boolean>
): Promise<StateMachineResult | null> {
  const cleanJid = rawSenderJid.split("@")[0].split(":")[0];
  const incomingNum = normalizePhoneNumber(cleanJid);

  // Find participant by LID number OR real phone number
  let participant = await prisma.user.findFirst({
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
      participant = await prisma.user.findFirst({
        where: {
          name: { contains: pushName.trim(), mode: "insensitive" },
          isExcluded: false,
        },
        orderBy: { updatedAt: "desc" },
      });
    }
    // DO NOT add any additional fallback - if we can't identify, return null silently
  }

  // STRICT RULE: If participant is NOT in the database, DO NOT REPLY!
  // KECUALI jika pesan berisi perintah registrasi (REG_xxx) atau login (AUTH_xxx)
  if (!participant) {
    const matchRegPayload = messageText.match(/REG_[a-f0-9]+/i) || messageText.match(/AUTH_[a-f0-9]+/i);
    if (matchRegPayload && matchRegPayload[0]) {
      // Buat partisipan baru
      participant = await prisma.user.create({
        data: {
          phoneNumber: realPhoneNum ? normalizePhoneNumber(realPhoneNum) : incomingNum,
          name: pushName || "Siswa Baru",
          status: RegistrationStatus.NOT_STARTED,
        },
      });
    } else {
      return null;
    }
  }

  // Auto-upgrade participant's phoneNumber to REAL Phone Number if we now have realPhoneNum
  if (realPhoneNum && realPhoneNum !== participant.phoneNumber) {
    const formattedRealNum = normalizePhoneNumber(realPhoneNum);
    if (formattedRealNum.startsWith("62")) {
      const existingReal = await prisma.user.findUnique({
        where: { phoneNumber: formattedRealNum },
      });

      if (existingReal && existingReal.id !== participant.id) {
        // Merge current LID participant into existing real phone number participant
        const merged = await prisma.user.update({
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
          await prisma.user.delete({ where: { id: participant.id } });
        } catch (e) {}
        participant = merged;
      } else {
        try {
          participant = await prisma.user.update({
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
      participant = await prisma.user.update({
        where: { id: participant.id },
        data: { name: pushName },
      });
    } catch (e) {}
  }

  // If excluded, do not respond automatically
  if (participant.isExcluded) {
    return null;
  }

  // 1. Handle GPS Location Check-In (only for COMPLETED participants)
  if (locationData) {
    if (participant.status !== RegistrationStatus.COMPLETED) {
      return {
        newStatus: participant.status as RegistrationStatusType,
        replyMessage: 'Maaf, fitur absensi GPS hanya tersedia untuk peserta yang sudah menyelesaikan pendaftaran. Silakan selesaikan pendaftaran terlebih dahulu.',
      };
    }
    const checkInResult = await processLocationCheckIn({
      prisma,
      userId: participant.id,
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

  // Handle Registration Command (REG_...)
  const matchRegPayload = text.match(/REG_[a-f0-9]+/i);
  if (matchRegPayload && matchRegPayload[0]) {
    const payloadId = matchRegPayload[0];
    
    if (participant.isExcluded) {
      return {
        newStatus: participant.status as RegistrationStatusType,
        replyMessage: "Maaf, akun Anda telah dinonaktifkan oleh admin.",
      };
    }

    // Cek keberadaan di Grup Utama
    let isInGroup = true;
    if (checkGroup) {
      isInGroup = await checkGroup(participant.phoneNumber);
    }

    if (!isInGroup) {
      let inviteLink = "Hubungi admin untuk mendapatkan link grup.";
      try {
        const linkSetting = await prisma.systemSetting.findUnique({ where: { key: "primary_group_invite_link" } });
        if (linkSetting && linkSetting.value) inviteLink = linkSetting.value;
      } catch (e) {}

      return {
        newStatus: participant.status as RegistrationStatusType,
        replyMessage: `Maaf, kamu belum bergabung di grup komunitas kami. Silakan join grup melalui link berikut terlebih dahulu:\n\n${inviteLink}`,
      };
    }

    // Jika ada di grup, set verified dan kirim link
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
      console.error("Error updating temp register payload:", err);
    }

    let baseUrl = process.env.APP_BASE_URL || process.env.NEXT_PUBLIC_APP_URL || process.env.RENDER_EXTERNAL_URL || "";
    if (!baseUrl || baseUrl.includes("localhost")) {
      const renderHost = process.env.RENDER_EXTERNAL_HOSTNAME;
      baseUrl = renderHost ? `https://${renderHost}` : "https://velonet.onrender.com";
    }
    baseUrl = baseUrl.replace(/\/$/, "");

    return {
      newStatus: participant.status as RegistrationStatusType,
      replyMessage: `Hello, this is your registration link:\n${baseUrl}/api/student/auth/verify-registration?token=${payloadId}`,
    };
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
    if (participant.isExcluded) {
      return {
        newStatus: participant.status as RegistrationStatusType,
        replyMessage: "Maaf, akun Anda telah dinonaktifkan oleh admin.",
      };
    }

    // Jika belum registrasi, cek grup dulu
    if (participant.status !== RegistrationStatus.COMPLETED) {
      let isInGroup = true;
      if (checkGroup) {
        isInGroup = await checkGroup(participant.phoneNumber);
      }

      if (!isInGroup) {
        let inviteLink = "Hubungi admin untuk mendapatkan link grup.";
        try {
          const linkSetting = await prisma.systemSetting.findUnique({ where: { key: "primary_group_invite_link" } });
          if (linkSetting && linkSetting.value) inviteLink = linkSetting.value;
        } catch (e) {}

        return {
          newStatus: participant.status as RegistrationStatusType,
          replyMessage: `Maaf, kamu belum bergabung di grup komunitas kami. Silakan join grup melalui link berikut terlebih dahulu:\n\n${inviteLink}`,
        };
      }
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
      where: { userId: participant.id, isUsed: false },
      data: { isUsed: true },
    });

    await prisma.otpVerification.create({
      data: {
        userId: participant.id,
        phoneNumber: participant.phoneNumber,
        otpCode,
        magicToken,
        expiresAt,
      },
    });

    let baseUrl = process.env.APP_BASE_URL || process.env.NEXT_PUBLIC_APP_URL || process.env.RENDER_EXTERNAL_URL || "";
    if (!baseUrl) {
      try {
        const setting = await prisma.systemSetting.findUnique({
          where: { key: "app_base_url" },
        });
        if (setting && setting.value && !setting.value.includes("localhost")) {
          baseUrl = setting.value;
        }
      } catch (e) {}
    }
    if (!baseUrl || baseUrl.includes("localhost")) {
      const renderHost = process.env.RENDER_EXTERNAL_HOSTNAME;
      baseUrl = renderHost ? `https://${renderHost}` : "https://velonet.onrender.com";
    }
    baseUrl = baseUrl.replace(/\/$/, "");

    const directLoginUrl = `${baseUrl}/api/student/auth/verify-magic?token=${magicToken}`;

    if (participant.status !== RegistrationStatus.COMPLETED) {
      return {
        newStatus: participant.status as RegistrationStatusType,
        replyMessage: `Hello, this is your registration link:\n${directLoginUrl}\n\n_(Silakan klik link di atas untuk melengkapi data pendaftaran Anda)_`,
      };
    }

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

  // Allow user to cancel registration at any step
  if (upperText === 'BATAL' || upperText === 'CANCEL' || upperText === 'STOP') {
    if (participant.status !== RegistrationStatus.COMPLETED && participant.status !== RegistrationStatus.OPTED_OUT) {
      await prisma.user.update({
        where: { id: participant.id },
        data: { status: RegistrationStatus.OPTED_OUT },
      });
      return {
        newStatus: RegistrationStatus.OPTED_OUT,
        replyMessage: 'Pendaftaran dibatalkan. Jika berubah pikiran, ketik *DAFTAR* untuk mendaftar ulang.',
      };
    }
  }

  switch (participant.status) {
    case RegistrationStatus.NOT_STARTED:
    case RegistrationStatus.WAITING_CONFIRMATION:
    case RegistrationStatus.WAITING_NAME:
    case RegistrationStatus.WAITING_CLASS:
    case RegistrationStatus.WAITING_MOTIVATION:
    case RegistrationStatus.WAITING_HOBBY:
      return {
        newStatus: participant.status as RegistrationStatusType,
        replyMessage: "Halo! Sistem pendaftaran sekarang menggunakan Web Form.\n\nSilakan daftar atau lengkapi profil Anda melalui Portal Siswa kami:\nhttps://velonet.onrender.com/student/login",
      };

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
        await prisma.user.update({
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
