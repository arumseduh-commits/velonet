import { NextResponse } from "next/server";
import { botEngine } from "@/lib/bot-engine";

export async function POST(req: Request) {
  try {
    const { inviteUrl } = await req.json();

    if (!inviteUrl || typeof inviteUrl !== "string") {
      return NextResponse.json(
        { success: false, error: "Link undangan WhatsApp (https://chat.whatsapp.com/...) wajib diisi." },
        { status: 400 }
      );
    }

    const result = await botEngine.joinGroupViaInvite(inviteUrl);

    return NextResponse.json({
      success: true,
      message: "Bot berhasil bergabung ke dalam Grup WhatsApp!",
      groupId: result.groupId,
    });
  } catch (err: any) {
    console.error("[JoinGroupAPI] Error:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Gagal bergabung ke grup via link undangan." },
      { status: 500 }
    );
  }
}
