import { NextResponse } from "next/server";
import { getLoggedInStudent } from "@/lib/student-auth";
import { prisma } from "@/lib/prisma";

export async function PATCH(req: Request) {
  try {
    const student = await getLoggedInStudent();
    if (!student) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { motivation, hobby } = await req.json();

    await prisma.participant.update({
      where: { id: student.id },
      data: {
        motivation: typeof motivation === "string" ? motivation : student.motivation,
        hobby: typeof hobby === "string" ? hobby : student.hobby,
      },
    });

    return NextResponse.json({
      success: true,
      message: "Profil siswa berhasil diperbarui!",
    });
  } catch (err: any) {
    console.error("[StudentProfileAPI] Error:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Terjadi kesalahan server." },
      { status: 500 }
    );
  }
}
