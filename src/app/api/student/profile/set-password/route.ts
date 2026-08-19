import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { getLoggedInStudent } from "@/lib/student-auth";

export async function POST(req: Request) {
  try {
    const user = await getLoggedInStudent();
    if (!user) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

    const { newPassword } = await req.json();
    if (!newPassword || newPassword.length < 6) {
      return NextResponse.json({ success: false, error: "Password minimal 6 karakter." }, { status: 400 });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await prisma.user.update({
      where: { id: user.id },
      data: { password: hashedPassword }
    });

    return NextResponse.json({ success: true, message: "Password berhasil disimpan!" });
  } catch (err) {
    console.error("[SetPassword] Error:", err);
    return NextResponse.json({ success: false, error: "Terjadi kesalahan saat menyimpan password." }, { status: 500 });
  }
}
