import { NextResponse } from "next/server";
import { getLoggedInStudent } from "@/lib/student-auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const student = await getLoggedInStudent();
    if (!student) {
      return NextResponse.json(
        { success: false, error: "Sesi Anda telah berakhir. Silakan login kembali." },
        { status: 401 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        id: student.id,
        name: student.name || "",
        phoneNumber: student.phoneNumber,
        studentClass: student.studentClass || "",
        gender: student.gender || "",
        birthDate: student.birthDate ? student.birthDate.toISOString().split("T")[0] : "",
        motivation: student.motivation || "",
        hobby: student.hobby || "",
        status: student.status,
      },
    });
  } catch (err: any) {
    console.error("[StudentProfileGET] Error:", err);
    return NextResponse.json(
      { success: false, error: "Terjadi kesalahan server." },
      { status: 500 }
    );
  }
}

export async function PATCH(req: Request) {
  try {
    const student = await getLoggedInStudent();
    if (!student) {
      return NextResponse.json(
        { success: false, error: "Sesi Anda telah berakhir. Silakan login kembali." },
        { status: 401 }
      );
    }

    const body = await req.json();
    const { name, studentClass, gender, motivation, hobby } = body;

    // Validate required fields for complete registration
    if (!name || typeof name !== "string" || !name.trim()) {
      return NextResponse.json(
        { success: false, error: "Nama Lengkap wajib diisi." },
        { status: 400 }
      );
    }

    if (!studentClass || typeof studentClass !== "string" || !studentClass.trim()) {
      return NextResponse.json(
        { success: false, error: "Kelas wajib diisi." },
        { status: 400 }
      );
    }

    if (!gender || (gender !== "Laki-laki" && gender !== "Perempuan")) {
      return NextResponse.json(
        { success: false, error: "Jenis Kelamin wajib dipilih (Laki-laki / Perempuan)." },
        { status: 400 }
      );
    }

    if (!motivation || typeof motivation !== "string" || !motivation.trim()) {
      return NextResponse.json(
        { success: false, error: "Alasan / Motivasi wajib diisi." },
        { status: 400 }
      );
    }

    if (!hobby || typeof hobby !== "string" || !hobby.trim()) {
      return NextResponse.json(
        { success: false, error: "Hobi wajib diisi." },
        { status: 400 }
      );
    }

    // Force Name to UPPERCASE per user rule ("nama default kapital")
    const formattedName = name.trim().toUpperCase();

    const updated = await prisma.user.update({
      where: { id: student.id },
      data: {
        name: formattedName,
        studentClass: studentClass.trim(),
        gender: gender.trim(),
        motivation: motivation.trim(),
        hobby: hobby.trim(),
        status: "COMPLETED",
      },
    });

    return NextResponse.json({
      success: true,
      message: "Pendaftaran berhasil disimpan! Selamat datang di Velocity.",
      data: {
        student: {
          id: updated.id,
          name: updated.name,
          phoneNumber: updated.phoneNumber,
          studentClass: updated.studentClass,
          gender: updated.gender,
          motivation: updated.motivation,
          hobby: updated.hobby,
          status: updated.status,
        },
      },
    });
  } catch (err: any) {
    console.error("[StudentProfileAPI] Error:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Terjadi kesalahan server." },
      { status: 500 }
    );
  }
}
