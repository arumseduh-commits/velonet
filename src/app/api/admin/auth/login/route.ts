import { NextResponse } from "next/server";
import { createAdminSession } from "@/lib/admin-auth";

export async function POST(req: Request) {
  try {
    const { username, password } = await req.json();

    if (!username || !password) {
      return NextResponse.json(
        { success: false, error: "Username dan Password/PIN wajib diisi." },
        { status: 400 }
      );
    }

    const expectedUsername = process.env.ADMIN_USERNAME || "admin";
    const expectedPassword = process.env.ADMIN_PASSWORD || "admin123";
    const defaultPin = "123456";

    const isUsernameMatch = username.trim().toLowerCase() === expectedUsername.toLowerCase();
    const isPasswordMatch =
      password.trim() === expectedPassword || password.trim() === defaultPin;

    if (!isUsernameMatch || !isPasswordMatch) {
      return NextResponse.json(
        {
          success: false,
          error: "Username atau Password/PIN Admin salah.",
        },
        { status: 401 }
      );
    }

    await createAdminSession(username.trim());

    return NextResponse.json({
      success: true,
      message: "Login Admin berhasil!",
      redirectUrl: "/admin",
    });
  } catch (err: any) {
    console.error("[AdminLogin] Error:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Terjadi kesalahan server." },
      { status: 500 }
    );
  }
}
