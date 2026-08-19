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
      include: { user: true },
    });

    if (
      !otpRecord ||
      otpRecord.isUsed ||
      new Date() > new Date(otpRecord.expiresAt) ||
      !otpRecord.user ||
      otpRecord.user.isExcluded
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
    const sessionToken = await createStudentSession(otpRecord.user.id, userAgent);

    // Construct redirect response and explicitly attach HTTP-Only Cookie
    const host = req.headers.get("x-forwarded-host") || req.headers.get("host") || url.host;
    const protocol = req.headers.get("x-forwarded-proto") || (url.protocol.startsWith("https") ? "https" : "http");
    const origin = process.env.APP_BASE_URL || process.env.RENDER_EXTERNAL_URL || `${protocol}://${host}`;

    const response = NextResponse.redirect(`${origin}/student`);
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
    const host = req.headers.get("x-forwarded-host") || req.headers.get("host") || url.host;
    const protocol = req.headers.get("x-forwarded-proto") || (url.protocol.startsWith("https") ? "https" : "http");
    const origin = process.env.APP_BASE_URL || process.env.RENDER_EXTERNAL_URL || `${protocol}://${host}`;
    return NextResponse.redirect(`${origin}/student/login?error=server_error`);
  }

}
