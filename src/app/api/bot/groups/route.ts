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

    // Fetch current Primary Group Settings
    const [primaryIdSetting, primaryNameSetting, primaryInviteSetting] = await Promise.all([
      prisma.systemSetting.findUnique({ where: { key: "primary_group_id" } }),
      prisma.systemSetting.findUnique({ where: { key: "primary_group_name" } }),
      prisma.systemSetting.findUnique({ where: { key: "primary_group_invite_link" } }),
    ]);

    const primaryGroup = {
      id: primaryIdSetting?.value || null,
      name: primaryNameSetting?.value || null,
      inviteLink: primaryInviteSetting?.value || null,
    };

    // If groupId is provided, fetch members for that group
    if (groupId) {
      const groupData = await botEngine.fetchGroupMembersWithStatus(groupId);
      return NextResponse.json({
        success: true,
        data: groupData,
        primaryGroup,
      });
    }

    // Otherwise, return all saved & detected groups list for dropdown
    const savedGroups = await botEngine.getSavedGroups();
    return NextResponse.json({
      success: true,
      data: savedGroups,
      primaryGroup,
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
    const { action, groupId, groupSubject, inviteLink, phoneNumber, targetJid, message } = body;

    // Check bot connection state before sending messages or fetching invite codes
    const botStatus = botEngine.getStatus();

    // 1. Action: Set Primary Group (Grup Utama Resmi Pendaftaran)
    if (action === "set_primary_group") {
      if (!groupId) {
        return NextResponse.json(
          { success: false, error: "Group ID (JID) wajib diisi." },
          { status: 400 }
        );
      }

      let cleanGroupId = groupId.trim();
      if (!cleanGroupId.includes("@g.us")) {
        cleanGroupId = `${cleanGroupId.replace(/\D/g, "")}@g.us`;
      }

      const subject = groupSubject || "Grup Komunitas Velocity";

      // Try auto-fetching invite link if not provided
      let finalInviteLink = (inviteLink || "").trim();
      if (!finalInviteLink && botStatus.state === "CONNECTED") {
        try {
          const fetchedLink = await botEngine.getGroupInviteLink(cleanGroupId);
          if (fetchedLink) {
            finalInviteLink = fetchedLink;
          }
        } catch (e) {}
      }

      await Promise.all([
        prisma.systemSetting.upsert({
          where: { key: "primary_group_id" },
          create: { key: "primary_group_id", value: cleanGroupId },
          update: { value: cleanGroupId },
        }),
        prisma.systemSetting.upsert({
          where: { key: "primary_group_name" },
          create: { key: "primary_group_name", value: subject },
          update: { value: subject },
        }),
        finalInviteLink
          ? prisma.systemSetting.upsert({
              where: { key: "primary_group_invite_link" },
              create: { key: "primary_group_invite_link", value: finalInviteLink },
              update: { value: finalInviteLink },
            })
          : Promise.resolve(),
        // Also save group info for quick listing
        prisma.systemSetting.upsert({
          where: { key: `group:${cleanGroupId}` },
          create: {
            key: `group:${cleanGroupId}`,
            value: JSON.stringify({ id: cleanGroupId, subject, size: 0 }),
          },
          update: {
            value: JSON.stringify({ id: cleanGroupId, subject, size: 0 }),
          },
        }),
      ]);

      return NextResponse.json({
        success: true,
        message: `Grup "${subject}" berhasil ditetapkan sebagai Grup Utama Resmi Pendaftaran!`,
        primaryGroup: {
          id: cleanGroupId,
          name: subject,
          inviteLink: finalInviteLink || null,
        },
      });
    }

    // 2. Action: Update Invite Link Only
    if (action === "update_invite_link") {
      if (!inviteLink) {
        return NextResponse.json(
          { success: false, error: "Link undangan grup wajib diisi." },
          { status: 400 }
        );
      }

      await prisma.systemSetting.upsert({
        where: { key: "primary_group_invite_link" },
        create: { key: "primary_group_invite_link", value: inviteLink.trim() },
        update: { value: inviteLink.trim() },
      });

      return NextResponse.json({
        success: true,
        message: "Link undangan grup WhatsApp berhasil diperbarui!",
        inviteLink: inviteLink.trim(),
      });
    }

    // 3. Action: Auto-fetch group invite link from WhatsApp socket
    if (action === "fetch_group_invite_link") {
      const targetGroup = groupId || (await prisma.systemSetting.findUnique({ where: { key: "primary_group_id" } }))?.value;
      if (!targetGroup) {
        return NextResponse.json(
          { success: false, error: "Group JID belum ditentukan." },
          { status: 400 }
        );
      }

      if (botStatus.state !== "CONNECTED") {
        return NextResponse.json(
          { success: false, error: "Bot WhatsApp belum terhubung." },
          { status: 400 }
        );
      }

      const fetchedLink = await botEngine.getGroupInviteLink(targetGroup);
      if (!fetchedLink) {
        return NextResponse.json(
          {
            success: false,
            error:
              "Gagal mengambil link undangan secara otomatis (Pastikan akun Bot adalah Admin di grup tersebut). Anda dapat memasukkan link undangan secara manual.",
          },
          { status: 400 }
        );
      }

      // Save automatically if this is the primary group
      await prisma.systemSetting.upsert({
        where: { key: "primary_group_invite_link" },
        create: { key: "primary_group_invite_link", value: fetchedLink },
        update: { value: fetchedLink },
      });

      return NextResponse.json({
        success: true,
        inviteLink: fetchedLink,
        message: "Link undangan grup berhasil ditarik otomatis dari WhatsApp!",
      });
    }

    // 4. Action: Unset Primary Group (Kembali ke mode open)
    if (action === "unset_primary_group") {
      await Promise.all([
        prisma.systemSetting.delete({ where: { key: "primary_group_id" } }).catch(() => {}),
        prisma.systemSetting.delete({ where: { key: "primary_group_name" } }).catch(() => {}),
      ]);
      return NextResponse.json({
        success: true,
        message: "Pengaturan Grup Utama dinonaktifkan (Mode Pendaftaran Terbuka aktif).",
      });
    }

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
