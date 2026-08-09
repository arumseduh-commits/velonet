import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createStudentSession, STUDENT_COOKIE_NAME } from "@/lib/student-auth";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const token = url.searchParams.get("token");

  if (!token) {
    return NextResponse.redirect(new URL("/student/login?error=missing_token", req.url));
  }

  try {
    const otpRecord = await prisma.otpVerification.findUnique({
      where: { magicToken: token },
      include: { participant: true },
    });

    if (
      !otpRecord ||
      otpRecord.isUsed ||
      new Date() > new Date(otpRecord.expiresAt) ||
      !otpRecord.participant ||
      otpRecord.participant.isExcluded
    ) {
      return NextResponse.redirect(new URL("/student/login?error=invalid_or_expired_link", req.url));
    }

    // Mark token as used
    await prisma.otpVerification.update({
      where: { id: otpRecord.id },
      data: { isUsed: true },
    });

    // Create session in DB
    const userAgent = req.headers.get("user-agent") || undefined;
    const sessionToken = await createStudentSession(otpRecord.participant.id, userAgent);

    // Construct redirect response and explicitly attach HTTP-Only Cookie
    const response = NextResponse.redirect(new URL("/student", req.url));
    response.cookies.set(STUDENT_COOKIE_NAME, sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 30 * 24 * 60 * 60, // 30 days
      path: "/",
    });

    return response;
  } catch (err) {
    console.error("[VerifyMagic] Error:", err);
    return NextResponse.redirect(new URL("/student/login?error=server_error", req.url));
  }
}
