import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { RegistrationStatus } from "@/lib/bot-state-machine";
import { botEngine } from "@/lib/bot-engine";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const kickList = await prisma.participant.findMany({
      where: { status: RegistrationStatus.OPTED_OUT },
      orderBy: { updatedAt: "desc" },
    });

    return NextResponse.json({
      success: true,
      data: kickList,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to fetch kick list." },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, isKickedFromGrp } = body;

    if (!id || typeof isKickedFromGrp !== "boolean") {
      return NextResponse.json(
        { success: false, error: "Invalid payload parameters." },
        { status: 400 }
      );
    }

    const updated = await prisma.participant.update({
      where: { id },
      data: { isKickedFromGrp },
    });

    return NextResponse.json({
      success: true,
      data: updated,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to update kick status." },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { participantId, groupId, targetJid, phoneNumber } = body;

    if (!groupId) {
      return NextResponse.json(
        { success: false, error: "Group ID is required to kick member." },
        { status: 400 }
      );
    }

    const target = targetJid || phoneNumber;
    if (!target) {
      return NextResponse.json(
        { success: false, error: "Target JID or phone number is required." },
        { status: 400 }
      );
    }

    const kicked = await botEngine.kickGroupMember(groupId, target);
    if (kicked && participantId) {
      await prisma.participant.update({
        where: { id: participantId },
        data: { isKickedFromGrp: true },
      });
    }

    return NextResponse.json({
      success: kicked,
      message: kicked
        ? `Berhasil mengeluarkan (kick) anggota dari grup!`
        : `Gagal mengeluarkan anggota. Pastikan bot adalah Admin di grup tersebut.`,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to kick member from WhatsApp group." },
      { status: 500 }
    );
  }
}
