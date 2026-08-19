import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getLoggedInStudent } from "@/lib/student-auth";

export async function POST(req: Request) {
  try {
    const student = await getLoggedInStudent();
    if (!student || !student.id) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const { name, birthDate, gender, studentClass, motivation, hobby, phoneNumber } = await req.json();

    if (!name || !studentClass || !motivation || !hobby || !birthDate || !gender) {
      return NextResponse.json({ success: false, error: "Harap isi semua kolom pendaftaran." }, { status: 400 });
    }

    if (name.trim().length < 4) {
      return NextResponse.json({ success: false, error: "Nama Lengkap minimal 4 huruf / karakter." }, { status: 400 });
    }

    // Validasi Usia Minimal 15 Tahun
    const birth = new Date(birthDate);
    if (isNaN(birth.getTime())) {
      return NextResponse.json({ success: false, error: "Format tanggal lahir tidak valid." }, { status: 400 });
    }

    const today = new Date();
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
      age--;
    }

    if (age < 15) {
      return NextResponse.json(
        { success: false, error: "Pendaftaran hanya diperuntukkan bagi siswa berusia minimal 15 tahun." },
        { status: 400 }
      );
    }

    // Format Phone Number jika user mengoreksi nomor HP asli
    let updatedPhone = student.phoneNumber;
    if (phoneNumber && typeof phoneNumber === "string") {
      const clean = phoneNumber.replace(/\D/g, "");
      if (clean.length >= 10 && clean.length <= 15) {
        updatedPhone = clean.startsWith("0") ? "62" + clean.slice(1) : clean.startsWith("62") ? clean : "62" + clean;
      }
    }

    await prisma.user.update({
      where: { id: student.id },
      data: {
        name: name.trim().toUpperCase(),
        phoneNumber: updatedPhone,
        birthDate: birth,
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
