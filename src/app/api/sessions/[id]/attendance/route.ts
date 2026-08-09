import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: sessionId } = await params;
    const body = await req.json();
    const { participantId, status, notes } = body;

    if (!participantId || !status) {
      return NextResponse.json(
        { error: "participantId dan status wajib diisi" },
        { status: 400 }
      );
    }

    if (status === "DELETE") {
      await prisma.attendance.deleteMany({
        where: {
          sessionId,
          participantId,
        },
      });
      return NextResponse.json({ success: true });
    }

    const attendance = await prisma.attendance.upsert({
      where: {
        sessionId_participantId: {
          sessionId,
          participantId,
        },
      },
      create: {
        sessionId,
        participantId,
        status,
        method: "MANUAL_ADMIN",
        notes: notes || "Diubah manual oleh Admin Dashboard",
      },
      update: {
        status,
        method: "MANUAL_ADMIN",
        notes: notes || "Diubah manual oleh Admin Dashboard",
      },
    });

    return NextResponse.json(attendance);
  } catch (error: any) {
    console.error("POST /api/sessions/[id]/attendance error:", error);
    return NextResponse.json(
      { error: "Gagal mengupdate status kehadiran peserta" },
      { status: 500 }
    );
  }
}
