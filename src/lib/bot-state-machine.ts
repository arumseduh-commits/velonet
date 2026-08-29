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
  let normalizedRealPhone = realPhoneNum ? normalizePhoneNumber(realPhoneNum) : undefined;

  // 0. If real phone number is not provided and incoming is an LID, lookup BaileysAuth LID mapping
  if (!normalizedRealPhone && (rawSenderJid.endsWith("@lid") || incomingNum.length > 13)) {
    try {
      const authRecord = await prisma.baileysAuth.findUnique({
        where: { key: `lid-mapping-${incomingNum}_reverse` },
      });
      if (authRecord && authRecord.value) {
        let val = authRecord.value.trim();
        try {
          val = JSON.parse(val);
        } catch (e) {}
        if (typeof val === "string") {
          const clean = val.replace(/\D/g, "");
          if ((clean.startsWith("62") || clean.startsWith("08")) && clean.length >= 10 && clean.length <= 15) {
            normalizedRealPhone = clean.startsWith("0") ? "62" + clean.slice(1) : clean;
          }
        }
      }
    } catch (e) {}
  }

  // 1. Find participant by real phone number FIRST if available
  let participant = null;
  if (normalizedRealPhone) {
    participant = await prisma.user.findUnique({
      where: { phoneNumber: normalizedRealPhone },
    });
  }

  // 2. If not found by real phone, search by incoming number (LID or raw phone)
  if (!participant) {
    participant = await prisma.user.findUnique({
      where: { phoneNumber: incomingNum },
    });
  }

  // Clean up dummy uncompleted LID user if real participant is found
  if (participant && normalizedRealPhone && incomingNum !== normalizedRealPhone) {
    try {
      const dummyLidUser = await prisma.user.findUnique({
        where: { phoneNumber: incomingNum },
      });
      if (dummyLidUser && dummyLidUser.id !== participant.id) {
        await prisma.user.delete({ where: { id: dummyLidUser.id } }).catch(() => {});
      }
    } catch (e) {}
  }

  // STRICT RULE: If participant is NOT in the database, DO NOT REPLY!
  // KECUALI jika pesan berisi perintah registrasi (REG_xxx) atau login (AUTH_xxx)
  if (!participant) {
    const matchRegPayload = messageText.match(/REG_[a-zA-Z0-9_]+/i) || messageText.match(/AUTH_[a-zA-Z0-9_]+/i);
    if (matchRegPayload && matchRegPayload[0]) {
      // Buat partisipan baru
      participant = await prisma.user.create({
        data: {
          phoneNumber: normalizedRealPhone || incomingNum,
          name: pushName || "Siswa Baru",
          status: RegistrationStatus.NOT_STARTED,
        },
      });
    } else {
      return null;
    }
  }

  // Auto-upgrade participant's phoneNumber to REAL Phone Number if we now have realPhoneNum
  if (normalizedRealPhone && normalizedRealPhone !== participant.phoneNumber) {
    if (normalizedRealPhone.startsWith("62")) {
      const existingReal = await prisma.user.findUnique({
        where: { phoneNumber: normalizedRealPhone },
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
            faceDescriptor: participant.faceDescriptor || existingReal.faceDescriptor,
            facePhoto: participant.facePhoto || existingReal.facePhoto,
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
              phoneNumber: normalizedRealPhone,
              name: participant.name || pushName || null,
            },
          });
        } catch (e) {}
      }
    }
  } else if (pushName && (!participant.name || participant.name === "Siswa Baru")) {
    try {
      participant = await prisma.user.update({
        where: { id: participant.id },
        data: { name: pushName },
      });
    } catch (e) {}
  }

  // Auto-heal status: If participant already has name and studentClass, ensure status is COMPLETED
  if (
    participant.status !== RegistrationStatus.COMPLETED &&
    participant.name &&
    participant.name !== "Siswa Baru" &&
    (participant.studentClass || participant.faceDescriptor)
  ) {
    try {
      participant = await prisma.user.update({
        where: { id: participant.id },
        data: { status: RegistrationStatus.COMPLETED },
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

  // 1. Check if participant is in WAITING_NAME_INPUT (typing new name)
  try {
    const waitingNameSetting = await prisma.systemSetting.findUnique({
      where: { key: `waiting_name_input:${participant.id}` },
    });

    if (waitingNameSetting) {
      // If setting is less than 24 hours old
      const settingData = JSON.parse(waitingNameSetting.value);
      if (settingData && Date.now() - settingData.timestamp < 86400000) {
        // Sanitize name: convert to uppercase (capslock), remove unwanted characters
        const cleanedName = text
          .replace(/[^\w\s.,'-]/gi, "")
          .trim()
          .replace(/\s+/g, " ")
          .toUpperCase();

        if (cleanedName.length >= 2) {
          await prisma.systemSetting.delete({
            where: { key: `waiting_name_input:${participant.id}` },
          });

          await prisma.user.update({
            where: { id: participant.id },
            data: { name: cleanedName },
          });

          return {
            newStatus: participant.status as RegistrationStatusType,
            replyMessage: `✅ *NAMA LENGKAP BERHASIL DIPERBARUI*\n\nTerima kasih Kak! Nama lengkap Anda telah diperbarui menjadi:\n👉 *${cleanedName}*\n\nData Anda telah tersimpan di sistem VeloNet. 🙏✨`,
          };
        }
      } else {
        await prisma.systemSetting.delete({
          where: { key: `waiting_name_input:${participant.id}` },
        });
      }
    }
  } catch (e) {
    console.error("Error processing waiting name input:", e);
  }

  // 2. Check if participant has PENDING_NAME_CONFIRMATION
  try {
    const nameConfirmSetting = await prisma.systemSetting.findUnique({
      where: { key: `name_confirm_pending:${participant.id}` },
    });

    if (nameConfirmSetting) {
      const settingData = JSON.parse(nameConfirmSetting.value);
      if (settingData && Date.now() - settingData.timestamp < 86400000) {
        const isYes =
          lowerText === "ya" ||
          lowerText === "y" ||
          lowerText === "benar" ||
          lowerText === "betul" ||
          lowerText === "sudah" ||
          lowerText === "sudah benar" ||
          lowerText === "ok" ||
          lowerText === "iya";

        const isNo =
          lowerText === "tidak" ||
          lowerText === "t" ||
          lowerText === "salah" ||
          lowerText === "bukan" ||
          lowerText === "ubah" ||
          lowerText === "ganti" ||
          lowerText === "bukan nama saya";

        if (isYes) {
          await prisma.systemSetting.delete({
            where: { key: `name_confirm_pending:${participant.id}` },
          });

          return {
            newStatus: participant.status as RegistrationStatusType,
            replyMessage: `✅ *KONFIRMASI NAMA DITERIMA*\n\nTerima kasih Kak *${
              participant.name || "Peserta"
            }*! Data nama lengkap Anda telah terkonfirmasi sesuai di sistem VeloNet. 🙏✨`,
          };
        } else if (isNo) {
          await prisma.systemSetting.delete({
            where: { key: `name_confirm_pending:${participant.id}` },
          });

          await prisma.systemSetting.create({
            data: {
              key: `waiting_name_input:${participant.id}`,
              value: JSON.stringify({
                timestamp: Date.now(),
                previousName: participant.name,
              }),
            },
          });

          return {
            newStatus: participant.status as RegistrationStatusType,
            replyMessage: `📝 *PERBAIKAN NAMA LENGKAP*\n\nBaik Kak, silakan ketik *Nama Lengkap yang Benar* langsung sebagai balasan pesan ini:`,
          };
        }
      } else {
        await prisma.systemSetting.delete({
          where: { key: `name_confirm_pending:${participant.id}` },
        });
      }
    }
  } catch (e) {
    console.error("Error processing pending name confirmation:", e);
  }

  // 3. Check if participant has PENDING_FACE_REMINDER
  try {
    const faceReminderSetting = await prisma.systemSetting.findUnique({
      where: { key: `face_reminder_pending:${participant.id}` },
    });

    if (faceReminderSetting) {
      const settingData = JSON.parse(faceReminderSetting.value);
      if (settingData && Date.now() - settingData.timestamp < 86400000) {
        const isAcceptFace =
          lowerText === "y" ||
          lowerText === "ya" ||
          lowerText === "iya" ||
          lowerText === "mau" ||
          lowerText === "daftar" ||
          lowerText === "link" ||
          lowerText === "info" ||
          lowerText === "rekam";

        if (isAcceptFace) {
          await prisma.systemSetting.delete({
            where: { key: `face_reminder_pending:${participant.id}` },
          });

          const magicToken = crypto.randomBytes(32).toString("hex");
          const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
          const expiresAt = new Date(Date.now() + 2 * 60 * 60 * 1000); // 2 hours

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

          const directFaceUrl = `${baseUrl}/api/student/auth/verify-magic?token=${magicToken}&redirect=/student/face-register`;

          return {
            newStatus: participant.status as RegistrationStatusType,
            replyMessage: `📸 *LINK PENDAFTARAN WAJAH (FACE ID) VELONET*\n\nHalo Kak *${
              participant.name || "Peserta"
            }*!\n\nSilakan klik link di bawah ini untuk membuka kamera dan merekam data biometrik wajah Anda secara mandiri:\n\n🔗 ${directFaceUrl}\n\n_📌 Pastikan pencahayaan terang dan wajah terlihat jelas tanpa masker. Link aktif selama 2 jam._ 🚀`,
          };
        }
      } else {
        await prisma.systemSetting.delete({
          where: { key: `face_reminder_pending:${participant.id}` },
        });
      }
    }
  } catch (e) {
    console.error("Error processing pending face reminder:", e);
  }

  // Handle Registration Command (REG_...)
  const matchRegPayload = text.match(/REG_[a-zA-Z0-9_]+/i);
  if (matchRegPayload && matchRegPayload[0]) {
    const payloadId = matchRegPayload[0];
    
    if (participant.isExcluded) {
      return {
        newStatus: participant.status as RegistrationStatusType,
        replyMessage: "Maaf, akun Anda telah dinonaktifkan oleh admin.",
      };
    }

    const isAlreadyCompleted =
      participant.status === RegistrationStatus.COMPLETED ||
      Boolean(participant.name && participant.name !== "Siswa Baru" && participant.studentClass);

    const greetingName = participant.name && participant.name !== "Siswa Baru" ? `Kak *${participant.name}*` : "Kak";

    // Cek keberadaan di Grup Utama secara ketat
    if (!isAlreadyCompleted) {
      let isInGroup = true;
      if (checkGroup) {
        isInGroup = await checkGroup(participant.phoneNumber);
      }

      if (!isInGroup) {
        let inviteLink = "Hubungi admin untuk mendapatkan link grup WhatsApp resmi.";
        try {
          const linkSetting = await prisma.systemSetting.findUnique({ where: { key: "primary_group_invite_link" } });
          if (linkSetting && linkSetting.value) inviteLink = linkSetting.value;
        } catch (e) {}

        // TIDAK set payload menjadi VERIFIED agar tidak bisa masuk web sebelum join grup
        return {
          newStatus: participant.status as RegistrationStatusType,
          replyMessage: `🚫 *PENDAFTARAN DITOLAK: BELUM GABUNG GRUP*\n\nHalo ${greetingName}!\n\nMohon maaf, pendaftaran anggota ekskul Velocity hanya diperuntukkan bagi peserta yang *sudah bergabung* di Grup WhatsApp Resmi Komunitas kami.\n\nSilakan klik link undangan di bawah ini untuk bergabung ke grup terlebih dahulu:\n👉 ${inviteLink}\n\n_Setelah berhasil bergabung di grup WhatsApp, silakan ulangi pendaftaran Anda di website atau kirim ulang pesan ini._ 🙏`,
        };
      }
    }

    // Set verified di payload jika nomor sudah ada di grup
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

    if (isAlreadyCompleted) {
      return {
        newStatus: RegistrationStatus.COMPLETED,
        replyMessage: `ℹ️ *AKUN ANDA SUDAH TERDAFTAR*\n\nHalo Kak *${participant.name}*!\n\nNomor WhatsApp Anda sudah terdaftar di Portal Siswa Velocity (*${participant.studentClass ? "Kelas " + participant.studentClass : "Aktif"}*).\n\nKlik link di bawah ini untuk *LANGSUNG MASUK* ke akun Portal Siswa Anda tanpa perlu mendaftar ulang:\n\n🔗 ${baseUrl}/api/student/auth/verify-registration?token=${payloadId}\n\n_⚠️ Link ini berlaku 10 menit. Selamat belajar! 🚀_`,
      };
    }

    return {
      newStatus: participant.status as RegistrationStatusType,
      replyMessage: `📝 *LINK PENDAFTARAN SISWA VELOCITY*\n\nHalo ${greetingName}!\n\nSilakan klik link di bawah ini untuk melengkapi formulir pendaftaran anggota ekskul Velocity:\n\n🔗 ${baseUrl}/api/student/auth/verify-registration?token=${payloadId}\n\n_⚠️ Link ini berlaku 10 menit. Silakan lengkapi biodata Anda._`,
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

    const isProfileCompleted =
      participant.status === RegistrationStatus.COMPLETED ||
      Boolean(participant.name && participant.name !== "Siswa Baru" && participant.studentClass);

    // Jika belum registrasi sama sekali, cek grup dulu secara ketat
    if (!isProfileCompleted) {
      let isInGroup = true;
      if (checkGroup) {
        isInGroup = await checkGroup(participant.phoneNumber);
      }

      if (!isInGroup) {
        let inviteLink = "Hubungi admin untuk mendapatkan link grup WhatsApp resmi.";
        try {
          const linkSetting = await prisma.systemSetting.findUnique({ where: { key: "primary_group_invite_link" } });
          if (linkSetting && linkSetting.value) inviteLink = linkSetting.value;
        } catch (e) {}

        return {
          newStatus: participant.status as RegistrationStatusType,
          replyMessage: `🚫 *AKSES DITOLAK: BELUM GABUNG GRUP*\n\nMohon maaf, Anda belum terdaftar di Grup WhatsApp Resmi Komunitas Velocity.\n\nSilakan bergabung ke grup terlebih dahulu melalui link berikut:\n👉 ${inviteLink}\n\n_Setelah bergabung di grup WhatsApp, silakan ulangi login/pendaftaran._ 🙏`,
        };
      }
    }

    // Extract payloadId if provided (e.g., "!login AUTH_e8f92a10b4c7_984102")
    const matchPayload = text.match(/AUTH_[a-zA-Z0-9_]+/i);
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

    if (!isProfileCompleted) {
      const displayName = participant.name && participant.name !== "Siswa Baru" ? participant.name : "Peserta";
      return {
        newStatus: participant.status as RegistrationStatusType,
        replyMessage: `📝 *LINK PENDAFTARAN SISWA VELOCITY*\n\nHalo Kak *${displayName}*!\n\nAnda belum melengkapi data pendaftaran Portal Siswa. Silakan klik link di bawah ini untuk melengkapi formulir pendaftaran:\n\n🔗 ${directLoginUrl}\n\n_⚠️ Link ini berlaku 10 menit. Selamat bergabung! 🚀_`,
      };
    }

    return {
      newStatus: RegistrationStatus.COMPLETED,
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

  const upperText = text.toUpperCase().trim();

  // 1. Tangani penolakan / pembatalan keikutsertaan ekskul (Masuk ke Kick List)
  const isDeclining =
    upperText === 'TIDAK' ||
    upperText === 'GA' ||
    upperText === 'GAK' ||
    upperText === 'ENGGAK' ||
    upperText === 'BATAL' ||
    upperText === 'CANCEL' ||
    upperText === 'STOP' ||
    upperText === 'TIDAK MAU' ||
    upperText === 'TIDAK IKUT' ||
    upperText === 'TIDAK BERSEDIA' ||
    upperText === 'KELUAR';

  if (isDeclining) {
    if (participant.status !== RegistrationStatus.COMPLETED) {
      await prisma.user.update({
        where: { id: participant.id },
        data: {
          status: RegistrationStatus.OPTED_OUT,
          isKickedFromGrp: false,
        },
      });
      return {
        newStatus: RegistrationStatus.OPTED_OUT,
        replyMessage: `❌ *KONFIRMASI PENOLAKAN DITERIMA*\n\nBaik, terima kasih atas konfirmasinya. Anda telah memilih untuk *TIDAK BERGABUNG* dengan Komunitas Velocity.\n\nNomor Anda telah dimasukkan ke dalam daftar peninjauan/pengeluaran dari grup WhatsApp.\n\n_Jika sewaktu-waktu Anda berubah pikiran dan ingin bergabung kembali, silakan hubungi admin atau ketik *DAFTAR*._`,
      };
    }
  }

  // 2. Tangani persetujuan / permintaan link pendaftaran
  const isAccepting =
    upperText === 'YA' ||
    upperText === 'DAFTAR' ||
    upperText === 'JOIN' ||
    upperText === 'MAU' ||
    upperText === 'IKUT' ||
    upperText === 'BERSEDIA';

  if (isAccepting && participant.status !== RegistrationStatus.COMPLETED) {
    const greeting = participant.name && participant.name !== "Siswa Baru" ? `Halo Kak *${participant.name}*!` : "Halo Kak!";

    // Cek keberadaan di Grup Utama sebelum memberikan link pendaftaran
    let isInGroup = true;
    if (checkGroup) {
      isInGroup = await checkGroup(participant.phoneNumber);
    }

    if (!isInGroup) {
      let inviteLink = "Hubungi admin untuk mendapatkan link grup WhatsApp resmi.";
      try {
        const linkSetting = await prisma.systemSetting.findUnique({ where: { key: "primary_group_invite_link" } });
        if (linkSetting && linkSetting.value) inviteLink = linkSetting.value;
      } catch (e) {}

      return {
        newStatus: RegistrationStatus.WAITING_CONFIRMATION,
        replyMessage: `🚫 *PENDAFTARAN DITOLAK: BELUM GABUNG GRUP*\n\n${greeting}\nMohon maaf, pendaftaran anggota ekskul Velocity hanya diperuntukkan bagi peserta yang *sudah bergabung* di Grup WhatsApp Resmi Komunitas kami.\n\nSilakan klik link undangan di bawah ini untuk bergabung ke grup terlebih dahulu:\n👉 ${inviteLink}\n\n_Setelah berhasil bergabung di grup WhatsApp, silakan balas *DAFTAR* atau *YA* untuk menerima link formulir pendaftaran._ 🙏`,
      };
    }

    const magicToken = crypto.randomBytes(32).toString("hex");
    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 2 * 60 * 60 * 1000); // 2 hours

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

    const directRegUrl = `${baseUrl}/api/student/auth/verify-magic?token=${magicToken}`;

    return {
      newStatus: RegistrationStatus.WAITING_CONFIRMATION,
      replyMessage: `🎉 *TERIMA KASIH ATAS KONFIRMASINYA!*\n\n${greeting}\nSilakan klik link di bawah ini untuk melengkapi formulir pendaftaran anggota ekskul Velocity:\n\n🔗 ${directRegUrl}\n\n_⏱️ Link pendaftaran aktif selama 2 jam. Selamat bergabung! 🚀_`,
    };
  }

  switch (participant.status) {
    case RegistrationStatus.NOT_STARTED:
    case RegistrationStatus.WAITING_CONFIRMATION:
    case RegistrationStatus.WAITING_NAME:
    case RegistrationStatus.WAITING_CLASS:
    case RegistrationStatus.WAITING_MOTIVATION:
    case RegistrationStatus.WAITING_HOBBY: {
      const greeting = participant.name && participant.name !== "Siswa Baru" ? `Halo Kak *${participant.name}*!` : "Halo Kak!";
      return {
        newStatus: RegistrationStatus.WAITING_CONFIRMATION,
        replyMessage: `${greeting} 👋\n\nKami dari *Komunitas English Club Velocity SMKN 1*.\nApakah Anda bersedia bergabung dan melengkapi data anggota ekskul Velocity?\n\nSilakan konfirmasi dengan membalas pesan ini:\n👉 Ketik *YA* (untuk menerima link pendaftaran resmi)\n👉 Ketik *TIDAK* (jika tidak ingin bergabung)\n\n_Terima kasih atas perhatiannya! 🙏_`,
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
