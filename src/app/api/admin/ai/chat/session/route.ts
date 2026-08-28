import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getLoggedInAdmin } from "@/lib/admin-auth";

export async function GET() {
  try {
    const admin = await getLoggedInAdmin();
    if (!admin) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const sessions = await prisma.aIChatSession.findMany({
      include: {
        messages: {
          orderBy: { createdAt: "asc" },
        },
      },
      orderBy: { updatedAt: "desc" },
    });

    return NextResponse.json({ success: true, data: sessions });
  } catch (err: any) {
    console.error("[AI Chat Sessions GET]", err);
    return NextResponse.json({ success: false, error: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const admin = await getLoggedInAdmin();
    if (!admin) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { title = "Sesi Konsultasi Guru", contextTopicId } = body;

    const session = await prisma.aIChatSession.create({
      data: {
        userId: admin.username || "admin",
        title,
        contextTopicId: contextTopicId || null,
        messages: {
          create: {
            role: "assistant",
            content: `Halo Guru/Mentor! Saya adalah **AI Teacher Assistant** VeloNet. Saya siap membantu Anda menyusun materi, membuat draf soal ujian multi-tipe (Pilihan Ganda, Checkboxes, Isian, & Uraian) berbasis bank materi MisterGuru, serta merancang rubrik penilaian.\n\nApa materi yang ingin kita bahas atau susun hari ini?`,
          },
        },
      },
      include: {
        messages: true,
      },
    });

    return NextResponse.json({ success: true, data: session });
  } catch (err: any) {
    console.error("[AI Chat Sessions POST]", err);
    return NextResponse.json({ success: false, error: "Internal Server Error" }, { status: 500 });
  }
}
