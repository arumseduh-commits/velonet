import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getLoggedInStudent } from "@/lib/student-auth";

export async function POST(req: Request) {
  try {
    const student = await getLoggedInStudent();
    if (!student || !student.id) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const { name, birthDate, gender, studentClass, motivation, hobby } = await req.json();

    if (!name || !studentClass || !motivation || !hobby || !birthDate || !gender) {
      return NextResponse.json({ success: false, error: "Harap isi semua kolom pendaftaran." }, { status: 400 });
    }

    await prisma.user.update({
      where: { id: student.id },
      data: {
        name: name.trim().toUpperCase(),
        birthDate: new Date(birthDate),
        gender: gender.trim(),
        studentClass: studentClass.trim(),
        motivation: motivation.trim(),
        hobby: hobby.trim(),
        status: "COMPLETED",
      },
    });

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("[CompleteProfile] Error:", err);
    return NextResponse.json({ success: false, error: "Terjadi kesalahan server." }, { status: 500 });
  }
}
