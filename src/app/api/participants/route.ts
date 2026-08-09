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
      whereClause.status = status;
    }

    const participants = await prisma.participant.findMany({
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

    const existing = await prisma.participant.findUnique({
      where: { phoneNumber: cleanNumber },
    });

    if (existing) {
      return NextResponse.json(
        { success: false, error: `Participant with number ${cleanNumber} already exists.` },
        { status: 400 }
      );
    }

    const newParticipant = await prisma.participant.create({
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
    const { id, ...data } = body;

    if (!id) {
      return NextResponse.json(
        { success: false, error: "Participant ID is required for update." },
        { status: 400 }
      );
    }

    const updated = await prisma.participant.update({
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
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { success: false, error: "Participant ID is required." },
        { status: 400 }
      );
    }

    await prisma.participant.delete({
      where: { id },
    });

    return NextResponse.json({
      success: true,
      message: "Participant deleted successfully.",
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to delete participant." },
      { status: 500 }
    );
  }
}
