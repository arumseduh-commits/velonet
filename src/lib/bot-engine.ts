import makeWASocket, {
  DisconnectReason,
  WASocket,
  fetchLatestBaileysVersion,
  isJidBroadcast,
} from "@whiskeysockets/baileys";
import { Boom } from "@hapi/boom";
import QRCode from "qrcode";
import { EventEmitter } from "events";
import pino from "pino";
import { prisma } from "./prisma";
import { usePrismaAuthState } from "./baileys-db-auth";
import { processIncomingMessage } from "./bot-state-machine";
import { startAutoCronScheduler } from "./auto-cron-scheduler";

export type BotConnectionState = "DISCONNECTED" | "CONNECTING" | "CONNECTED";

export interface BotStatus {
  state: BotConnectionState;
  qrCodeUrl: string | null;
  userInfo: { id: string; name?: string } | null;
  lastError: string | null;
}

class WhatsAppBotEngine extends EventEmitter {
  private socket: WASocket | null = null;
  private connectionState: BotConnectionState = "DISCONNECTED";
  private qrCodeUrl: string | null = null;
  private userInfo: { id: string; name?: string } | null = null;
  private lastError: string | null = null;
  private clearAuthState: (() => Promise<void>) | null = null;
  private isInitializing: boolean = false;

  constructor() {
    super();
  }

  public getStatus(): BotStatus {
    return {
      state: this.connectionState,
      qrCodeUrl: this.qrCodeUrl,
      userInfo: this.userInfo,
      lastError: this.lastError,
    };
  }

  private updateStatus(
    state: BotConnectionState,
    qrUrl: string | null = null,
    user: { id: string; name?: string } | null = null,
    error: string | null = null
  ) {
    this.connectionState = state;
    this.qrCodeUrl = qrUrl;
    this.userInfo = user ?? this.userInfo;
    this.lastError = error;

    this.emit("status", this.getStatus());
    this.emit("log", `Status changed to: ${state}${error ? ` (${error})` : ""}`);
  }

  public async requestPairingCode(phoneNumber: string): Promise<string> {
    if (!this.socket) {
      await this.startBot();
      // Small pause for socket creation
      await new Promise((res) => setTimeout(res, 2000));
    }
    if (!this.socket) {
      throw new Error("Bot socket failed to initialize.");
    }
    const cleanNumber = phoneNumber.replace(/\D/g, "");
    const formattedNum = cleanNumber.startsWith("0") ? "62" + cleanNumber.slice(1) : cleanNumber;
    const code = await this.socket.requestPairingCode(formattedNum);
    this.emit("log", `🔑 Generated WhatsApp Pairing Code: ${code} for phone +${formattedNum}`);
    return code;
  }

  public async startBot() {
    if (this.socket || this.isInitializing) {
      console.log("[BotEngine] Bot is already running or initializing.");
      return;
    }

    this.isInitializing = true;
    this.updateStatus("CONNECTING");

    try {
      const { state, saveCreds, clearState } = await usePrismaAuthState(prisma);
      this.clearAuthState = clearState;

      const { version } = await fetchLatestBaileysVersion();
      const logger = pino({ level: "silent" });

      const sock = makeWASocket({
        version,
        logger,
        auth: state,
        printQRInTerminal: false,
        keepAliveIntervalMs: 15000, // Keeps TCP pipe active on Cloud proxies (prevents 408/428 timeouts)
        connectTimeoutMs: 60000,
        defaultQueryTimeoutMs: 60000,
        retryRequestDelayMs: 2000,
        markOnlineOnConnect: true,
        shouldIgnoreJid: (jid) => isJidBroadcast(jid),
      });

      this.socket = sock;

      sock.ev.on("creds.update", saveCreds);

      sock.ev.on("connection.update", async (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
          try {
            const qrDataUrl = await QRCode.toDataURL(qr);
            this.qrCodeUrl = qrDataUrl;
            this.updateStatus("CONNECTING", qrDataUrl, null, null);
          } catch (err) {
            console.error("[BotEngine] Failed to generate QR Code Data URL:", err);
          }
        }

        if (connection === "close") {
          const statusCode = (lastDisconnect?.error as Boom)?.output?.statusCode;
          const isLoggedOut = statusCode === DisconnectReason.loggedOut;
          const isRestartRequired =
            statusCode === DisconnectReason.restartRequired || statusCode === 515;

          this.socket = null;
          this.isInitializing = false;

          if (isLoggedOut) {
            this.emit("log", "Session logged out by user. Clearing database credentials...");
            if (this.clearAuthState) {
              await this.clearAuthState();
            }
            this.updateStatus("DISCONNECTED", null, null, "Session Logged Out");
          } else if (isRestartRequired) {
            this.emit("log", "WhatsApp server pairing handshake complete (code 515). Finalizing connection...");
            this.updateStatus("CONNECTING", null, null, "Finalizing Pairing");
            setTimeout(() => this.startBot(), 500);
          } else {
            // Smooth silent background reconnect without wiping state
            this.emit("log", `Cloud network blip (code ${statusCode}). Silently reconnecting in 1.5s...`);
            this.updateStatus("CONNECTING", null, this.userInfo, `Reconnecting (Code ${statusCode})`);
            setTimeout(() => this.startBot(), 1500);
          }
        } else if (connection === "open") {
          this.isInitializing = false;
          const userJid = sock.user?.id || "";
          const userName = sock.user?.name || "Velocity Bot";
          this.qrCodeUrl = null;
          this.updateStatus("CONNECTED", null, { id: userJid, name: userName }, null);
          this.emit("log", `WhatsApp Bot connected successfully as ${userName} (${userJid})!`);

          const botPhone = userJid.split("@")[0].split(":")[0];
          if (botPhone) {
            prisma.systemSetting.upsert({
              where: { key: "bot_phone_number" },
              create: { key: "bot_phone_number", value: botPhone },
              update: { value: botPhone },
            }).catch(() => {});
          }

          startAutoCronScheduler();
        }
      });

      sock.ev.on("messages.upsert", async (m) => {
        for (const msg of m.messages) {
          if (!msg.message) continue;

          const remoteJid = msg.key.remoteJid;
          if (!remoteJid) continue;

          const locMsg = msg.message.locationMessage || msg.message.liveLocationMessage;
          const conversationText =
            msg.message.conversation ||
            msg.message.extendedTextMessage?.text ||
            (locMsg as any)?.caption ||
            "";

          if (!conversationText && !locMsg) continue;

          const cleanCmd = conversationText.trim().toLowerCase();

          // Group Message Handling (@g.us)
          if (remoteJid.endsWith("@g.us")) {
            // ALWAYS log the Group JID whenever a group message arrives
            this.emit(
              "log",
              `📌 GROUP ACTIVITY DETECTED! Group JID: "${remoteJid}"`
            );

            // Respond to .jid or .id command
            if (
              cleanCmd === ".jid" ||
              cleanCmd === "!jid" ||
              cleanCmd === "jid" ||
              cleanCmd === ".id" ||
              cleanCmd === "!id" ||
              cleanCmd === "id"
            ) {
              await sock.sendMessage(remoteJid, {
                text: `📌 *ID Group WhatsApp ini:*\n\`${remoteJid}\`\n\nGunakan JID ini di Admin Dashboard VeloNet!`,
              });
              continue;
            }

            // Skip messages sent by bot itself in group
            if (msg.key.fromMe) continue;

            const groupSenderJid = (msg as any).participant || (msg.key as any).participant;
            const pushName = msg.pushName || undefined;

            // Automatically catch group replies like "ya", "iya", "hadir", "ikut", "lanjut", "ok"
            if (
              groupSenderJid &&
              ["ya", "iya", "hadir", "lanjut", "ok", "ikut", "siap", "y"].includes(cleanCmd)
            ) {
              let realPhoneNum: string | undefined = undefined;
              if (groupSenderJid.endsWith("@s.whatsapp.net")) {
                realPhoneNum = groupSenderJid.split("@")[0].split(":")[0];
              }

              const result = await processIncomingMessage(
                prisma,
                groupSenderJid,
                conversationText,
                pushName,
                realPhoneNum
              );

              if (result && result.replyMessage) {
                this.emit("log", `✅ Group confirmation recorded for member [${groupSenderJid}]`);
                await sock.sendMessage(remoteJid, {
                  text: `@${groupSenderJid.split("@")[0]} ${result.replyMessage}`,
                  mentions: [groupSenderJid],
                });
              }
            }
            continue;
          }

          // Skip self-sent 1-on-1 DMs
          if (msg.key.fromMe) continue;

          // Process DM message for registered participants
          const pushName = msg.pushName || undefined;
          let realPhoneNum: string | undefined = undefined;

          if (remoteJid.endsWith("@s.whatsapp.net")) {
            realPhoneNum = remoteJid.split("@")[0].split(":")[0];
          } else if ((msg as any).participant && (msg as any).participant.endsWith("@s.whatsapp.net")) {
            realPhoneNum = (msg as any).participant.split("@")[0].split(":")[0];
          } else if (remoteJid.endsWith("@lid")) {
            try {
              const res = await sock.onWhatsApp(remoteJid);
              if (res && Array.isArray(res)) {
                for (const item of res) {
                  if (item && item.jid) {
                    const raw = item.jid.split("@")[0].split(":")[0];
                    if (raw.startsWith("62")) {
                      realPhoneNum = raw;
                      break;
                    }
                  }
                }
              }
            } catch (e) {}
          }

          let locationData: import("./bot-state-machine").LocationPayload | undefined = undefined;
          if (
            locMsg &&
            typeof locMsg.degreesLatitude === "number" &&
            typeof locMsg.degreesLongitude === "number"
          ) {
            const rawTs = (msg as any).messageTimestamp;
            const msgTs =
              typeof rawTs === "number"
                ? rawTs
                : rawTs && typeof rawTs === "object"
                ? Number(rawTs)
                : undefined;

            const isFwd = Boolean(
              (locMsg.contextInfo as any)?.isForwarded ||
                (msg.message.extendedTextMessage?.contextInfo as any)?.isForwarded
            );

            locationData = {
              latitude: locMsg.degreesLatitude,
              longitude: locMsg.degreesLongitude,
              messageTimestamp: msgTs,
              isForwarded: isFwd,
            };
          }

          try {
            const result = await processIncomingMessage(
              prisma,
              remoteJid,
              conversationText,
              pushName,
              realPhoneNum,
              locationData
            );

            // STRICT RULE: If result is null (unknown user or excluded), DO NOT REPLY!
            if (result && result.replyMessage) {
              await sock.sendMessage(remoteJid, { text: result.replyMessage });
              this.emit(
                "log",
                `Replied to ${remoteJid}: "${result.replyMessage.slice(0, 40)}..."`
              );
            } else {
              this.emit(
                "log",
                `Silent mode / No auto-reply for ${remoteJid} (Allows human admin chat)`
              );
            }
          } catch (err: any) {
            console.error("[BotEngine] Error processing incoming message:", err);
          }
        }
      });
    } catch (err: any) {
      this.socket = null;
      this.isInitializing = false;
      this.updateStatus("DISCONNECTED", null, null, err.message || "Failed to start bot");
      console.error("[BotEngine] Start failed:", err);
    }
  }

  /**
   * Universal JID Sender function.
   * Formats any phone number or group ID into valid WhatsApp JID and sends message directly.
   * Examples:
   * - '120363041234567890@g.us' -> Group Chat
   * - '120363041234567890' -> Group Chat ('120363041234567890@g.us')
   * - '628123456789' / '08123456789' -> Private Chat ('628123456789@s.whatsapp.net')
   */
  public async sendToJid(targetInput: string, text: string): Promise<boolean> {
    if (!this.socket || this.connectionState !== "CONNECTED") {
      throw new Error("WhatsApp Bot is not connected.");
    }

    let jid = targetInput.trim();

    if (!jid.includes("@")) {
      const cleaned = jid.replace(/\D/g, "");
      if (cleaned.length > 15) {
        // Group ID format
        jid = `${cleaned}@g.us`;
      } else {
        // Standard Phone number format
        const formattedNum = cleaned.startsWith("0") ? "62" + cleaned.slice(1) : cleaned;
        jid = `${formattedNum}@s.whatsapp.net`;
      }
    }

    try {
      // Simulate human typing presence ('composing') ONLY for standard @s.whatsapp.net DMs
      // (Do NOT call sendPresenceUpdate on @lid JIDs as WhatsApp server rejects @lid presence frames and revokes session)
      if (jid.endsWith("@s.whatsapp.net")) {
        try {
          await this.socket.sendPresenceUpdate("composing", jid);
          const typingTime = Math.floor(Math.random() * 300) + 300; // Fast 0.3s - 0.6s typing simulation
          await new Promise((res) => setTimeout(res, typingTime));
          await this.socket.sendPresenceUpdate("paused", jid);
        } catch (e) {}
      }

      await this.socket.sendMessage(jid, { text });
      if (jid.endsWith("@lid")) {
        this.emit(
          "log",
          `⚠️ [Catatan LID] Pesan dikirim ke ID Privat [${jid}]. Jika pesan tidak masuk di HP penerima, hal tersebut karena privasi WA penerima menyembunyikan nomor HP. Disarankan Impor/Buka Nomor HP Asli.`
        );
      } else {
        this.emit("log", `Successfully sent message to JID [${jid}]: "${text.slice(0, 40)}..."`);
      }
      return true;
    } catch (err: any) {
      console.error(`[BotEngine] Failed to send message to JID [${jid}]:`, err);
      this.emit("log", `Failed to send message to JID [${jid}]: ${err.message}`);
      return false;
    }
  }

  public async sendMessage(phoneNumber: string, text: string): Promise<boolean> {
    return this.sendToJid(phoneNumber, text);
  }

  public async getSavedGroups() {
    const list: Array<{ id: string; subject: string; size: number }> = [];

    // 1. Fetch saved groups from SystemSetting table
    try {
      const settings = await prisma.systemSetting.findMany({
        where: { key: { startsWith: "group:" } },
      });
      for (const s of settings) {
        try {
          const parsed = JSON.parse(s.value);
          if (parsed && parsed.id && parsed.subject) {
            list.push(parsed);
          }
        } catch (e) {}
      }
    } catch (e) {}

    // 2. Fetch active participating groups from socket if connected
    if (this.socket && this.connectionState === "CONNECTED") {
      try {
        const groups = await this.socket.groupFetchAllParticipating();
        for (const g of Object.values(groups)) {
          if (!list.some((item) => item.id === g.id)) {
            list.push({
              id: g.id,
              subject: g.subject,
              size: g.participants?.length || 0,
            });
          }
        }
      } catch (e) {}
    }

    return list;
  }

  public async fetchGroupMembersWithStatus(groupIdInput: string) {
    if (!this.socket || this.connectionState !== "CONNECTED") {
      throw new Error("WhatsApp Bot is not connected.");
    }

    let cleanGroupId = groupIdInput.trim();
    if (!cleanGroupId.includes("@g.us")) {
      const digits = cleanGroupId.replace(/\D/g, "");
      cleanGroupId = `${digits}@g.us`;
    }

    const metadata = await this.socket.groupMetadata(cleanGroupId);
    if (!metadata || !metadata.participants) {
      throw new Error("Tidak dapat mengambil data anggota grup. Pastikan ID Grup benar.");
    }

    // Fast batch resolution of LID JIDs with 8s timeout safeguard
    const lidMembers = metadata.participants.filter(
      (p) => p.id.endsWith("@lid") && !(p as any).pn
    );
    const resolvedLidMap = new Map<string, string>();

    console.log("Group Metadata Participants sample:", metadata.participants[0]);

    if (lidMembers.length > 0) {
      try {
        const lidJids = lidMembers.map((m) => m.id);
        console.log(`Resolving ${lidJids.length} LID members via onWhatsApp...`);
        const onWaPromise = this.socket.onWhatsApp(...lidJids);
        const timeoutPromise = new Promise<null>((resolve) => setTimeout(() => resolve(null), 8000));
        const res = await Promise.race([onWaPromise, timeoutPromise]);

        console.log("onWhatsApp raw result:", res);

        if (res && Array.isArray(res)) {
          for (let i = 0; i < res.length; i++) {
            const item = res[i];
            const originalLid = lidMembers[i]?.id;
            if (item && item.jid) {
              if (originalLid) {
                resolvedLidMap.set(originalLid, item.jid);
              }
              if ((item as any).lid) {
                resolvedLidMap.set((item as any).lid, item.jid);
              }
            }
          }
        }
        console.log("Resolved LID Map size:", resolvedLidMap.size);
      } catch (e) {
        console.error("LID resolution error:", e);
      }
    }

    const membersList = [];
    for (const p of metadata.participants) {
      let fullJid = p.id;
      let pnJid = (p as any).pn || (p as any).phoneNumber || (p as any).phone || resolvedLidMap.get(fullJid);

      let displayPhone = "";
      if (pnJid) {
        const rawPn = pnJid.split("@")[0].split(":")[0];
        displayPhone = rawPn.startsWith("0") ? "62" + rawPn.slice(1) : rawPn;
      } else if (fullJid.endsWith("@s.whatsapp.net")) {
        const rawPn = fullJid.split("@")[0].split(":")[0];
        displayPhone = rawPn.startsWith("0") ? "62" + rawPn.slice(1) : rawPn;
      } else {
        // Do not set raw LID digits as displayPhone (prevents raw LIDs from being saved into Participant table)
        displayPhone = "";
      }

      // Extract clean digits for bot's own phone number & LID without device suffix (e.g. 6285187257740:12 -> 6285187257740)
      const cleanBotNum = (this.userInfo?.id || "").split("@")[0].split(":")[0];
      const cleanBotLid = (this.socket?.user?.lid || "").split("@")[0].split(":")[0];

      const cleanMemberNum = fullJid.split("@")[0].split(":")[0];
      const cleanMemberPn = pnJid ? pnJid.split("@")[0].split(":")[0] : "";

      // Strictly skip bot's own account (matches phone number or LID)
      if (
        (cleanBotNum && (cleanMemberNum === cleanBotNum || cleanMemberPn === cleanBotNum)) ||
        (cleanBotLid && (cleanMemberNum === cleanBotLid || cleanMemberPn === cleanBotLid))
      ) {
        continue;
      }

      let participant = displayPhone
        ? await prisma.participant.findFirst({
            where: {
              OR: [
                { phoneNumber: displayPhone },
                ...(pnJid ? [{ phoneNumber: pnJid.split("@")[0] }] : []),
              ],
            },
          })
        : null;

      // If pnJid resolved a real 62 number, auto-update participant's phoneNumber in DB if it was previously an LID
      if (participant && pnJid) {
        const cleanPn = pnJid.split("@")[0].split(":")[0];
        const formattedPn = cleanPn.startsWith("0") ? "62" + cleanPn.slice(1) : cleanPn;
        if (formattedPn.startsWith("62") && participant.phoneNumber !== formattedPn) {
          const existingReal = await prisma.participant.findUnique({
            where: { phoneNumber: formattedPn },
          });

          if (existingReal && existingReal.id !== participant.id) {
            const merged = await prisma.participant.update({
              where: { id: existingReal.id },
              data: {
                name: participant.name || existingReal.name || null,
                studentClass: participant.studentClass || existingReal.studentClass || null,
                motivation: participant.motivation || existingReal.motivation || null,
                hobby: participant.hobby || existingReal.hobby || null,
                status: participant.status !== "NOT_STARTED" ? participant.status : existingReal.status,
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
                data: { phoneNumber: formattedPn },
              });
            } catch (e) {}
          }
        }
      }

      const finalPhone =
        participant && participant.phoneNumber && participant.phoneNumber.startsWith("62")
          ? participant.phoneNumber
          : displayPhone || fullJid.split("@")[0];

      // Prioritize real phone number JID (@s.whatsapp.net) over @lid JID so WhatsApp servers deliver DMs to handset
      let targetJid = pnJid;
      if (!targetJid && participant?.phoneNumber && participant.phoneNumber.startsWith("62")) {
        targetJid = `${participant.phoneNumber}@s.whatsapp.net`;
      }
      if (!targetJid && fullJid.endsWith("@s.whatsapp.net")) {
        targetJid = fullJid;
      }
      if (!targetJid) {
        targetJid = fullJid; // Fallback to LID JID if no phone number available
      }

      membersList.push({
        id: participant?.id || null,
        jid: targetJid,
        pnJid: pnJid || (fullJid.endsWith("@s.whatsapp.net") ? fullJid : null),
        phoneNumber: finalPhone,
        isLid: fullJid.endsWith("@lid") && !pnJid,
        name: participant?.name || null,
        studentClass: participant?.studentClass || null,
        status: participant?.status || "NOT_CONTACTED",
        isExcluded: participant?.isExcluded || false,
        isKickedFromGrp: participant?.isKickedFromGrp || false,
        lastSentAt: participant?.lastSentAt ? new Date(participant.lastSentAt).toISOString() : null,
      });
    }

    // Save group to SystemSetting for persistent dropdown selector
    try {
      await prisma.systemSetting.upsert({
        where: { key: `group:${metadata.id}` },
        create: {
          key: `group:${metadata.id}`,
          value: JSON.stringify({
            id: metadata.id,
            subject: metadata.subject,
            size: membersList.length,
            updatedAt: Date.now(),
          }),
        },
        update: {
          value: JSON.stringify({
            id: metadata.id,
            subject: metadata.subject,
            size: membersList.length,
            updatedAt: Date.now(),
          }),
        },
      });
    } catch (e) {}

    return {
      groupId: metadata.id,
      groupSubject: metadata.subject,
      totalMembers: membersList.length,
      members: membersList,
    };
  }

  public async sendConfirmationToMember(jidOrPhone: string): Promise<boolean> {
    if (!this.socket || this.connectionState !== "CONNECTED") {
      throw new Error("WhatsApp Bot is not connected.");
    }

    const rawNum = jidOrPhone.split("@")[0].split(":")[0];
    const cleanNum = rawNum.startsWith("0") ? "62" + rawNum.slice(1) : rawNum;

    let participant = await prisma.participant.findFirst({
      where: {
        OR: [
          { phoneNumber: cleanNum },
          { phoneNumber: rawNum },
        ],
      },
    });

    if (!participant) {
      participant = await prisma.participant.create({
        data: {
          phoneNumber: cleanNum,
          status: "WAITING_CONFIRMATION",
        },
      });
    } else {
      await prisma.participant.update({
        where: { id: participant.id },
        data: {
          status: "WAITING_CONFIRMATION",
          isExcluded: false,
        },
      });
    }

    const initMsg =
      "Halo! Apakah kamu masih ingin melanjutkan pelatihan ekskul Bahasa Inggris di komunitas Velocity?\n\nBalas *YA* untuk lanjut, atau *TIDAK* untuk keluar.";

    // Prioritize standard phone number (628xxx@s.whatsapp.net) over @lid to prevent WA session revocation!
    let targetToSend = jidOrPhone;
    if (participant && participant.phoneNumber && participant.phoneNumber.startsWith("62")) {
      targetToSend = `${participant.phoneNumber}@s.whatsapp.net`;
    }

    const sent = await this.sendToJid(targetToSend, initMsg);
    if (sent) {
      await prisma.participant.update({
        where: { id: participant.id },
        data: { lastSentAt: new Date() },
      });
    }
    return sent;
  }

  public async sendGroupAnnouncement(groupId: string, customMessage?: string): Promise<boolean> {
    if (!this.socket || this.connectionState !== "CONNECTED") {
      throw new Error("WhatsApp Bot is not connected.");
    }

    const groupData = await this.fetchGroupMembersWithStatus(groupId);
    const waitingMembers = groupData.members.filter(
      (m) => m.status !== "COMPLETED" && m.status !== "OPTED_OUT" && !m.isExcluded
    );

    if (waitingMembers.length === 0) {
      this.emit("log", "Semua anggota di grup ini sudah mengonfirmasi pendaftaran.");
      return true;
    }

    const mentions: string[] = [];
    let memberListText = "";
    for (const m of waitingMembers) {
      const jid = m.pnJid || m.jid;
      if (jid) mentions.push(jid);
      const numDisplay = m.phoneNumber.startsWith("62") ? `+${m.phoneNumber}` : m.name || m.phoneNumber;
      memberListText += `• ${numDisplay}\n`;
    }

    const text =
      customMessage ||
      `📢 *PENGUMUMAN KONFIRMASI EKSKUL VELOCITY*\n\n` +
      `Halo teman-teman! Mohon konfirmasi kelanjutan pendaftaran ekskul Bahasa Inggris.\n\n` +
      `Bagi anggota berikut yang belum konfirmasi:\n${memberListText}\n` +
      `Silakan chat personal ke bot ini dengan mengetik *YA* untuk lanjut atau *TIDAK* untuk keluar.\n\nTerima kasih banyak! 🙏`;

    await this.socket.sendMessage(groupId, { text, mentions });
    this.emit(
      "log",
      `📢 [Pengumuman Grup Berhasil] Pesan konfirmasi dikirim langsung di dalam grup [${groupId}] dengan tag ${waitingMembers.length} anggota.`
    );
    return true;
  }

  public async kickGroupMember(groupIdInput: string, participantJidOrPhone: string): Promise<boolean> {
    if (!this.socket || this.connectionState !== "CONNECTED") {
      throw new Error("WhatsApp Bot is not connected.");
    }

    let cleanGroupId = groupIdInput.trim();
    if (!cleanGroupId.includes("@g.us")) {
      const digits = cleanGroupId.replace(/\D/g, "");
      cleanGroupId = `${digits}@g.us`;
    }

    const cleanInput = participantJidOrPhone.trim();
    const cleanDigits = cleanInput.replace(/\D/g, "");
    const formattedNum = cleanDigits.startsWith("0") ? "62" + cleanDigits.slice(1) : cleanDigits;

    let targetJidToKick = cleanInput;

    // Fetch group metadata to locate exact participant JID in group
    try {
      const metadata = await this.socket.groupMetadata(cleanGroupId);
      if (metadata && metadata.participants) {
        const found = metadata.participants.find((p) => {
          const pDigits = p.id.split("@")[0].split(":")[0];
          const pPnDigits = (p as any).pn ? (p as any).pn.split("@")[0].split(":")[0] : "";
          return (
            p.id === cleanInput ||
            pDigits === formattedNum ||
            pDigits === cleanDigits ||
            pPnDigits === formattedNum ||
            pPnDigits === cleanDigits
          );
        });

        if (found) {
          targetJidToKick = found.id;
        }
      }
    } catch (e) {
      console.warn("[BotEngine] Could not pre-fetch group metadata for kick:", e);
    }

    if (!targetJidToKick.includes("@")) {
      targetJidToKick = `${formattedNum}@s.whatsapp.net`;
    }

    try {
      await this.socket.groupParticipantsUpdate(cleanGroupId, [targetJidToKick], "remove");
      this.emit("log", `🔨 KICKED MEMBER [${targetJidToKick}] from Group [${cleanGroupId}]`);
      return true;
    } catch (err: any) {
      console.error(`[BotEngine] Failed to kick member [${targetJidToKick}] from group [${cleanGroupId}]:`, err);
      this.emit("log", `❌ Failed to kick member [${targetJidToKick}]: ${err.message || err}`);
      return false;
    }
  }

  public async joinGroupViaInvite(inviteUrlOrCode: string): Promise<{ success: boolean; groupId?: string; error?: string }> {
    if (!this.socket || this.connectionState !== "CONNECTED") {
      throw new Error("WhatsApp Bot belum terhubung.");
    }

    try {
      const codeMatch = inviteUrlOrCode.match(/(?:chat\.whatsapp\.com\/)?([a-zA-Z0-9_-]+)/);
      const code = codeMatch ? codeMatch[1] : inviteUrlOrCode.trim();

      const groupId = await this.socket.groupAcceptInvite(code);
      this.emit("log", `✅ BOT JOINED GROUP via invite code [${code}] -> Group JID: ${groupId}`);
      return { success: true, groupId };
    } catch (err: any) {
      console.error("[BotEngine] Failed to join group via invite code:", err);
      throw new Error(err.message || "Gagal bergabung ke grup via link undangan.");
    }
  }

  public async logoutBot() {
    this.emit("log", "Logging out bot session...");
    if (this.socket) {
      try {
        await this.socket.logout();
      } catch (e) {
        // ignore disconnect errors during logout
      }
      this.socket = null;
    }

    if (this.clearAuthState) {
      await this.clearAuthState();
    } else {
      await prisma.baileysAuth.deleteMany({});
    }

    this.userInfo = null;
    this.qrCodeUrl = null;
    this.updateStatus("DISCONNECTED", null, null, "Explicitly Logged Out");
  }
}

// Global Singleton Instance (Must be active in BOTH dev and production)
const globalForBot = globalThis as unknown as {
  botEngine: WhatsAppBotEngine | undefined;
};

export const botEngine = globalForBot.botEngine ?? new WhatsAppBotEngine();
globalForBot.botEngine = botEngine;
