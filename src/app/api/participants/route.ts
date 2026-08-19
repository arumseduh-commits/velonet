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

    const participants = await prisma.user.findMany({
      where: whereClause,
      orderBy: { updatedAt: "desc" },
    });

    return NextResponse.json({
      success: true,
      data: participants,
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
        name: name || null,
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
