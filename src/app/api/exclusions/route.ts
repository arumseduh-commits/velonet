import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { normalizePhoneNumber } from "@/lib/bot-state-machine";

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

    const whereClause: any = { isExcluded: true };
    if (query) {
      whereClause.OR = [
        { name: { contains: query, mode: "insensitive" } },
        { phoneNumber: { contains: query } },
      ];
    }

    const [total, exclusions] = await prisma.$transaction([
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
      data: exclusions,
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
      { success: false, error: error.message || "Failed to fetch exclusions." },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { phoneNumber, name } = body;

    if (!phoneNumber) {
      return NextResponse.json(
        { success: false, error: "Phone number is required." },
        { status: 400 }
      );
    }

    const cleanNum = normalizePhoneNumber(phoneNumber);

    const participant = await prisma.user.upsert({
      where: { phoneNumber: cleanNum },
      create: {
        phoneNumber: cleanNum,
        name: name || "Admin / Pembina",
        isExcluded: true,
      },
      update: {
        isExcluded: true,
        name: name || undefined,
      },
    });

    return NextResponse.json({
      success: true,
      data: participant,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to add exclusion." },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { success: false, error: "Participant ID is required." },
        { status: 400 }
      );
    }

    const updated = await prisma.user.update({
      where: { id },
      data: { isExcluded: false },
    });

    return NextResponse.json({
      success: true,
      data: updated,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to remove exclusion." },
      { status: 500 }
    );
  }
}
