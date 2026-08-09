import { NextResponse } from "next/server";
import { getLoggedInStudent } from "@/lib/student-auth";
import { processLeaveRequest } from "@/lib/attendance";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  try {
    const student = await getLoggedInStudent();
    if (!student) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { type, notes } = await req.json();

    if (!type || (type !== "IZIN" && type !== "SAKIT")) {
      return NextResponse.json(
        { success: false, error: "Kategori harus IZIN atau SAKIT." },
        { status: 400 }
      );
    }

    const result = await processLeaveRequest(
      prisma,
      student.id,
      type,
      notes || `Pengajuan ${type} via Web`
    );

    return NextResponse.json({
      success: result.success,
      message: result.replyMessage.replace(/\*/g, ""),
    });
  } catch (err: any) {
    console.error("[StudentLeaveAPI] Error:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Terjadi kesalahan server." },
      { status: 500 }
    );
  }
}
