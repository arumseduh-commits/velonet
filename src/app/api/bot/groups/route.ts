import { NextRequest, NextResponse } from "next/server";
import { botEngine } from "@/lib/bot-engine";
import { prisma } from "@/lib/prisma";

// Humanized Anti-Spam Delay Helper (Prevents WA Account Banning)
const delay = (ms: number) => new Promise((res) => setTimeout(res, ms));
const getRandomDelay = (minMs = 3000, maxMs = 5000) =>
  Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;

export async function GET(req: NextRequest) {
  try {
    const groupId = req.nextUrl.searchParams.get("groupId");

    // If groupId is provided, fetch members for that group
    if (groupId) {
      const groupData = await botEngine.fetchGroupMembersWithStatus(groupId);
      return NextResponse.json({
        success: true,
        data: groupData,
      });
    }

    // Otherwise, return all saved & detected groups list for dropdown
    const savedGroups = await botEngine.getSavedGroups();
    return NextResponse.json({
      success: true,
      data: savedGroups,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to fetch groups data." },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action, groupId, phoneNumber, targetJid, message } = body;

    // Check bot connection state before sending messages
    const botStatus = botEngine.getStatus();
    if (
      (action === "send_jid_message" ||
        action === "send_member_confirmation" ||
        action === "send_all_group_members" ||
        action === "send_all_uncontacted") &&
      botStatus.state !== "CONNECTED"
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Service Bot WhatsApp belum terhubung (Status: " +
            botStatus.state +
            "). Silakan klik 'Mulai Service Bot' atau scan QR/tautkan kode terlebih dahulu.",
        },
        { status: 400 }
      );
    }

    // Direct JID Message Sender
    if (action === "send_jid_message" || (targetJid && message)) {
      const target = targetJid || groupId;
      if (!target || !message) {
        return NextResponse.json(
          { success: false, error: "Target JID dan isi pesan wajib diisi." },
          { status: 400 }
        );
      }
      const sent = await botEngine.sendToJid(target, message);
      return NextResponse.json({
        success: sent,
        message: sent
          ? `Pesan berhasil dikirim ke Target JID: ${target}`
          : `Gagal mengirim pesan ke Target JID: ${target}`,
      });
    }

    // Single Member Confirmation Sender
    if (action === "send_member_confirmation") {
      const target = targetJid || phoneNumber;
      if (!target) {
        return NextResponse.json(
          { success: false, error: "Target JID or phone number is required." },
          { status: 400 }
        );
      }
      const sent = await botEngine.sendConfirmationToMember(target);
      return NextResponse.json({
        success: sent,
        message: sent
          ? `Pesan konfirmasi dikirim ke JID [${target}]`
          : `Gagal mengirim ke JID [${target}]`,
      });
    }

    // Async Batch Group Member Confirmation Sender
    if (action === "send_all_group_members") {
      if (!groupId) {
        return NextResponse.json(
          { success: false, error: "Group ID is required." },
          { status: 400 }
        );
      }

      const groupData = await botEngine.fetchGroupMembersWithStatus(groupId);

      // Trigger background broadcast loop without blocking HTTP POST response
      (async () => {
        let successCount = 0;
        let failCount = 0;
        let sentCounter = 0;

        botEngine.emit(
          "log",
          `🚀 [Broadcast Group] Memulai pengiriman pesan ke ${groupData.members.length} anggota...`
        );

        for (const m of groupData.members) {
          if (m.status === "COMPLETED" || m.status === "OPTED_OUT" || m.isExcluded) {
            continue;
          }
          try {
            const target = m.jid || m.phoneNumber;
            const sent = await botEngine.sendConfirmationToMember(target);
            if (sent) {
              successCount++;
              sentCounter++;
            } else {
              failCount++;
            }

            // Anti-Spam Safeguard: Every 6 messages, take a 15s cool-off break
            if (sentCounter > 0 && sentCounter % 6 === 0) {
              botEngine.emit(
                "log",
                `☕ [Anti-Spam] Istirahat 15 detik setelah mengirim ${sentCounter} pesan...`
              );
              await delay(15000);
            } else {
              await delay(getRandomDelay(3000, 5000));
            }
          } catch (e) {
            failCount++;
          }
        }

        botEngine.emit(
          "log",
          `✅ [Broadcast Selesai] Pesan berhasil terkirim ke ${successCount} anggota, gagal ${failCount}.`
        );
      })();

      return NextResponse.json({
        success: true,
        message: `🚀 Broadcast DM telah dimulai! Bot sedang mengirimkan pesan satu per satu secara otomatis (periksa log di samping).`,
      });
    }

    // Async Broadcast to All Uncontacted Registered Participants
    if (action === "send_all_uncontacted") {
      const uncontacted = await prisma.participant.findMany({
        where: {
          isExcluded: false,
          status: { in: ["NOT_STARTED", "WAITING_CONFIRMATION"] },
        },
      });

      // Trigger background broadcast loop without blocking HTTP POST response
      (async () => {
        let successCount = 0;
        let failCount = 0;
        let sentCounter = 0;

        botEngine.emit(
          "log",
          `🚀 [Broadcast Uncontacted] Memulai pengiriman pesan ke ${uncontacted.length} nomor HP...`
        );

        for (const p of uncontacted) {
          try {
            const sent = await botEngine.sendConfirmationToMember(p.phoneNumber);
            if (sent) {
              successCount++;
              sentCounter++;
            } else {
              failCount++;
            }

            // Anti-Spam Safeguard: Every 6 messages, take a 15s cool-off break
            if (sentCounter > 0 && sentCounter % 6 === 0) {
              botEngine.emit(
                "log",
                `☕ [Anti-Spam] Istirahat 15 detik setelah mengirim ${sentCounter} pesan...`
              );
              await delay(15000);
            } else {
              await delay(getRandomDelay(3000, 5000));
            }
          } catch (e) {
            failCount++;
          }
        }

        botEngine.emit(
          "log",
          `✅ [Broadcast Selesai] Pesan berhasil terkirim ke ${successCount} nomor HP, gagal ${failCount}.`
        );
      })();

      return NextResponse.json({
        success: true,
        message: `🚀 Broadcast DM telah dimulai! Bot sedang mengirimkan pesan satu per satu secara otomatis (periksa log di samping).`,
      });
    }

    return NextResponse.json(
      { success: false, error: "Action parameter is invalid." },
      { status: 400 }
    );
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to process group API action." },
      { status: 500 }
    );
  }
}
