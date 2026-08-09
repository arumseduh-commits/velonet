import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createStudentSession } from "@/lib/student-auth";

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
      otpRecord.participant.isExcluded
    ) {
      return NextResponse.redirect(new URL("/student/login?error=invalid_or_expired_link", req.url));
    }

    // Mark as used
    await prisma.otpVerification.update({
      where: { id: otpRecord.id },
      data: { isUsed: true },
    });

    // Create session and set HTTP-Only cookie
    const userAgent = req.headers.get("user-agent") || undefined;
    await createStudentSession(otpRecord.participant.id, userAgent);

    return NextResponse.redirect(new URL("/student", req.url));
  } catch (err) {
    console.error("[VerifyMagic] Error:", err);
    return NextResponse.redirect(new URL("/student/login?error=server_error", req.url));
  }
}
