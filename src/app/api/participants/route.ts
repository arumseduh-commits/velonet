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

    // Auto-heal any LID phone numbers found in the results
    const healedParticipants = await Promise.all(
      participants.map(async (p) => {
        const isLid = p.phoneNumber.length > 14 || (!p.phoneNumber.startsWith("62") && !p.phoneNumber.startsWith("08"));
        if (isLid) {
          try {
            const { botEngine } = await import("@/lib/bot-engine");
            const resolved = await botEngine.resolveLidToRealPhone(p.phoneNumber);
            if (resolved && (resolved.startsWith("62") || resolved.startsWith("08"))) {
              const existingReal = await prisma.user.findUnique({
                where: { phoneNumber: resolved },
              });
              if (existingReal && existingReal.id !== p.id) {
                // Merge
                const merged = await prisma.user.update({
                  where: { id: existingReal.id },
                  data: {
                    name: p.name || existingReal.name,
                    studentClass: p.studentClass || existingReal.studentClass,
                    motivation: p.motivation || existingReal.motivation,
                    hobby: p.hobby || existingReal.hobby,
                    status: p.status !== "NOT_STARTED" ? p.status : existingReal.status,
                    faceDescriptor: p.faceDescriptor || existingReal.faceDescriptor,
                    facePhoto: p.facePhoto || existingReal.facePhoto,
                  },
                });
                await prisma.user.delete({ where: { id: p.id } }).catch(() => {});
                return merged;
              } else {
                return await prisma.user.update({
                  where: { id: p.id },
                  data: { phoneNumber: resolved },
                });
              }
            }
          } catch (e) {}
        }
        return p;
      })
    );

    return NextResponse.json({
      success: true,
      data: healedParticipants,
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
