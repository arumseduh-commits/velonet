import { NextRequest, NextResponse } from "next/server";
import { botEngine } from "@/lib/bot-engine";
import { prisma } from "@/lib/prisma";

// Heavy Anti-Spam Delay Helper (Prevents WA Account Banning / Disconnects)
const delay = (ms: number) => new Promise((res) => setTimeout(res, ms));
const getRandomDelay = (minMs = 10000, maxMs = 16000) =>
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
      (action === "send_jid_message" || action === "send_member_confirmation") &&
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
