import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { RegistrationStatus } from "@/lib/bot-state-machine";
import { botEngine } from "@/lib/bot-engine";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const pageParam = searchParams.get("page");
    const limitParam = searchParams.get("limit");
    const query = searchParams.get("query") || "";

    const page = Math.max(1, parseInt(pageParam || "1", 10) || 1);
    const isAll = limitParam === "ALL";
    const limit = isAll ? undefined : (parseInt(limitParam || "", 10) || 10);

    const whereClause: any = { status: RegistrationStatus.OPTED_OUT };
    if (query) {
      whereClause.OR = [
        { name: { contains: query, mode: "insensitive" } },
        { phoneNumber: { contains: query } },
      ];
    }

    const [total, kickList] = await prisma.$transaction([
      prisma.user.count({ where: whereClause }),
      prisma.user.findMany({
        where: whereClause,
        orderBy: { updatedAt: "desc" },
        ...(limit && !isAll ? { take: limit, skip: (page - 1) * limit } : {}),
      }),
    ]);

    const totalPages = isAll || !limit ? 1 : Math.ceil(total / limit) || 1;

    return NextResponse.json({
      success: true,
      data: kickList,
      pagination: {
        total,
        page: isAll ? 1 : page,
        limit: isAll ? "ALL" : (limit || total),
        totalPages,
        hasNext: !isAll && page < totalPages,
        hasPrev: !isAll && page > 1,
      },
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

    const updated = await prisma.user.update({
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
    const { userId, groupId, targetJid, phoneNumber } = body;

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
    if (kicked && userId) {
      await prisma.user.update({
        where: { id: userId },
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
