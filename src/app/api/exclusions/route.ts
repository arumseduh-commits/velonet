import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { normalizePhoneNumber } from "@/lib/bot-state-machine";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const exclusions = await prisma.user.findMany({
      where: { isExcluded: true },
      orderBy: { updatedAt: "desc" },
    });

    return NextResponse.json({
      success: true,
      data: exclusions,
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
