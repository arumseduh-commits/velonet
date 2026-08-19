import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { createStudentSession } from "@/lib/student-auth";

export async function POST(req: Request) {
  try {
    const { phoneNumber, password } = await req.json();

    if (!phoneNumber || !password) {
      return NextResponse.json({ success: false, error: "Nomor HP dan Password wajib diisi." }, { status: 400 });
    }

    // 1. Cari user berdasarkan nomor HP (dukung 08xx dan 628xx)
    const cleanPhone = phoneNumber.replace(/\D/g, "");
    const formattedPhone = cleanPhone.startsWith("0") ? "62" + cleanPhone.slice(1) : cleanPhone;

    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { phoneNumber: formattedPhone },
          { phoneNumber: cleanPhone },
          { phoneNumber: phoneNumber.trim() },
        ],
      },
    });

    if (!user) {
      return NextResponse.json({ success: false, error: "Nomor HP tidak terdaftar." }, { status: 404 });
    }

    if (user.isExcluded) {
      return NextResponse.json({ success: false, error: "Akun ini telah dinonaktifkan." }, { status: 403 });
    }

    // 2. Cek apakah user sudah set password
    if (!user.password) {
      return NextResponse.json({ 
        success: false, 
        error: "Akun ini belum memiliki password. Silakan login via WhatsApp dan atur password di menu Profil." 
      }, { status: 400 });
    }

    // 3. Verifikasi Password menggunakan bcrypt
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return NextResponse.json({ success: false, error: "Password salah." }, { status: 401 });
    }

    // 4. Buat sesi login
    const ip = req.headers.get("x-forwarded-for") || req.headers.get("remote-addr");
    const userAgent = req.headers.get("user-agent");
    await createStudentSession(user.id, userAgent || "", ip || "");

    const isCompleted = user.status === "COMPLETED" || Boolean(user.name && user.name !== "Siswa Baru" && user.studentClass);
    const redirectUrl = isCompleted ? "/student" : "/student/complete-profile";

    return NextResponse.json({ success: true, redirectUrl });
  } catch (err) {
    console.error("[LoginPassword] Error:", err);
    return NextResponse.json({ success: false, error: "Terjadi kesalahan internal server." }, { status: 500 });
  }
}
