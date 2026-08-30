import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { normalizePhoneNumber } from "@/lib/bot-state-machine";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const query = searchParams.get("query") || "";
    const status = searchParams.get("status") || "ALL";

    const whereClause: any = {};

    if (query) {
      whereClause.OR = [
        { name: { contains: query, mode: "insensitive" } },
        { phoneNumber: { contains: query } },
        { studentClass: { contains: query, mode: "insensitive" } },
      ];
    }

    if (status && status !== "ALL") {
      if (status === "ACTIVE") {
        whereClause.status = "COMPLETED";
      } else if (status === "WAITING") {
        whereClause.status = { in: ["WAITING_CONFIRMATION", "WAITING_NAME", "NOT_STARTED"] };
      } else {
        whereClause.status = status;
      }
    }

    const pageParam = searchParams.get("page");
    const limitParam = searchParams.get("limit");

    const page = Math.max(1, parseInt(pageParam || "1", 10));
    const isAll = limitParam === "ALL";
    const limit = isAll ? undefined : Math.max(1, parseInt(limitParam || "10", 10));
    const safeLimit = limit ?? 10;

    const selectFields = {
      id: true,
      phoneNumber: true,
      name: true,
      studentClass: true,
      motivation: true,
      hobby: true,
      gender: true,
      birthDate: true,
      status: true,
      role: true,
      isExcluded: true,
      isKickedFromGrp: true,
      lastSentAt: true,
      faceDescriptor: true,
      faceRegisteredAt: true,
      createdAt: true,
      updatedAt: true,
    };

    if (isAll) {
      const [total, participants] = await prisma.$transaction([
        prisma.user.count({ where: whereClause }),
        prisma.user.findMany({
          where: whereClause,
          select: selectFields,
          orderBy: { updatedAt: "desc" },
        }),
      ]);

      return NextResponse.json({
        success: true,
        data: participants,
        pagination: {
          total,
          page: 1,
          limit: "ALL",
          totalPages: 1,
          hasNext: false,
          hasPrev: false,
        },
      });
    }

    const [total, participants] = await prisma.$transaction([
      prisma.user.count({ where: whereClause }),
      prisma.user.findMany({
        where: whereClause,
        select: selectFields,
        take: safeLimit,
        skip: (page - 1) * safeLimit,
        orderBy: { updatedAt: "desc" },
      }),
    ]);

    const totalPages = Math.ceil(total / safeLimit) || 1;

    return NextResponse.json({
      success: true,
      data: participants,
      pagination: {
        total,
        page,
        limit: safeLimit,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to fetch participants." },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { phoneNumber, name, studentClass, isExcluded } = body;

    if (!phoneNumber) {
      return NextResponse.json(
        { success: false, error: "Phone number is required." },
        { status: 400 }
      );
    }

    const cleanNumber = normalizePhoneNumber(phoneNumber);

    const existing = await prisma.user.findUnique({
      where: { phoneNumber: cleanNumber },
    });

    if (existing) {
      return NextResponse.json(
        { success: false, error: `Participant with number ${cleanNumber} already exists.` },
        { status: 400 }
      );
    }

    const newParticipant = await prisma.user.create({
      data: {
        phoneNumber: cleanNumber,
        name: name ? name.trim().toUpperCase() : null,
        studentClass: studentClass || null,
        isExcluded: Boolean(isExcluded),
      },
    });

    return NextResponse.json({
      success: true,
      data: newParticipant,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to create participant." },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, ids, ...data } = body;

    if (data.name && typeof data.name === "string") {
      data.name = data.name.trim().toUpperCase();
    }

    // Bulk update support
    if (Array.isArray(ids) && ids.length > 0) {
      const result = await prisma.user.updateMany({
        where: { id: { in: ids } },
        data,
      });

      return NextResponse.json({
        success: true,
        message: `${result.count} peserta berhasil diperbarui.`,
        count: result.count,
      });
    }

    if (!id) {
      return NextResponse.json(
        { success: false, error: "Participant ID or IDs array is required for update." },
        { status: 400 }
      );
    }

    const updated = await prisma.user.update({
      where: { id },
      data,
    });

    return NextResponse.json({
      success: true,
      data: updated,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to update participant." },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const singleId = searchParams.get("id");

    let ids: string[] = [];

    // Support JSON body bulk delete
    try {
      const body = await req.json();
      if (Array.isArray(body.ids)) {
        ids = body.ids;
      }
    } catch (e) {
      // Body may be empty if query params used
    }

    if (singleId) {
      ids.push(singleId);
    }

    if (ids.length === 0) {
      return NextResponse.json(
        { success: false, error: "Participant ID or IDs array is required for deletion." },
        { status: 400 }
      );
    }

    const result = await prisma.user.deleteMany({
      where: { id: { in: ids } },
    });

    return NextResponse.json({
      success: true,
      message: `${result.count} peserta berhasil dihapus.`,
      count: result.count,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to delete participant(s)." },
      { status: 500 }
    );
  }
}
