import { NextRequest, NextResponse } from "next/server";
import { botEngine } from "@/lib/bot-engine";
import { prisma } from "@/lib/prisma";

// Humanized Anti-Spam Delay Helper (Prevents WA Account Banning)
const delay = (ms: number) => new Promise((res) => setTimeout(res, ms));
const getRandomDelay = (minMs = 3500, maxMs = 6500) =>
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

    // Batch Group Member Confirmation Sender with Humanized Anti-Spam Delays
    if (action === "send_all_group_members") {
      if (!groupId) {
        return NextResponse.json(
          { success: false, error: "Group ID is required." },
          { status: 400 }
        );
      }
      const groupData = await botEngine.fetchGroupMembersWithStatus(groupId);
      let successCount = 0;
      let failCount = 0;
      let sentCounter = 0;

      for (const m of groupData.members) {
        if (m.status === "COMPLETED" || m.status === "OPTED_OUT" || m.isExcluded) {
          continue; // Skip members who completed or declined or excluded
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

          // Anti-Spam Safeguard: Every 6 messages, take a 20-second cool-off break
          if (sentCounter > 0 && sentCounter % 6 === 0) {
            console.log(`[AntiSpam Protection] Cool-off break: pausing 20s after ${sentCounter} messages...`);
            await delay(20000);
          } else {
            // Humanized anti-spam pause between each DM (4.5s - 8.5s)
            await delay(getRandomDelay(4500, 8500));
          }
        } catch (e) {
          failCount++;
        }
      }

      return NextResponse.json({
        success: true,
        message: `Broadcast selesai. Dikirim ke ${successCount} anggota, gagal ${failCount}.`,
        data: { successCount, failCount, total: groupData.members.length },
      });
    }

    // Broadcast to All Uncontacted Registered Participants with Humanized Delays
    if (action === "send_all_uncontacted") {
      const uncontacted = await prisma.participant.findMany({
        where: {
          isExcluded: false,
          status: { in: ["NOT_STARTED", "WAITING_CONFIRMATION"] },
        },
      });

      let successCount = 0;
      let failCount = 0;
      let sentCounter = 0;

      for (const p of uncontacted) {
        try {
          const sent = await botEngine.sendConfirmationToMember(p.phoneNumber);
          if (sent) {
            successCount++;
            sentCounter++;
          } else {
            failCount++;
          }

          // Anti-Spam Safeguard: Every 6 messages, take a 20-second cool-off break
          if (sentCounter > 0 && sentCounter % 6 === 0) {
            console.log(`[AntiSpam Protection] Cool-off break: pausing 20s after ${sentCounter} messages...`);
            await delay(20000);
          } else {
            // Humanized anti-spam pause between each DM (4.5s - 8.5s)
            await delay(getRandomDelay(4500, 8500));
          }
        } catch (e) {
          failCount++;
        }
      }

      return NextResponse.json({
        success: true,
        message: `Broadcast langsung selesai. Dikirim ke ${successCount} nomor HP, gagal ${failCount}.`,
        data: { successCount, failCount, total: uncontacted.length },
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
