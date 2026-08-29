import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createStudentSession, STUDENT_COOKIE_NAME } from "@/lib/student-auth";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const token = url.searchParams.get("token");

  const host = req.headers.get("x-forwarded-host") || req.headers.get("host") || url.host;
  const protocol = req.headers.get("x-forwarded-proto") || (url.protocol.startsWith("https") ? "https" : "http");
  const origin = process.env.APP_BASE_URL || process.env.RENDER_EXTERNAL_URL || `${protocol}://${host}`;

  if (!token) {
    return NextResponse.redirect(`${origin}/student/expired?reason=missing_token`);
  }

  try {
    const otpRecord = await prisma.otpVerification.findUnique({
      where: { magicToken: token },
      include: { user: true },
    });

    if (!otpRecord) {
      return NextResponse.redirect(`${origin}/student/expired?reason=not_found`);
    }

    if (otpRecord.isUsed) {
      return NextResponse.redirect(`${origin}/student/expired?reason=already_used`);
    }

    if (new Date() > new Date(otpRecord.expiresAt)) {
      return NextResponse.redirect(`${origin}/student/expired?reason=expired`);
    }

    if (!otpRecord.user || otpRecord.user.isExcluded) {
      return NextResponse.redirect(`${origin}/student/expired?reason=account_disabled`);
    }

    // Mark token as used
    await prisma.otpVerification.update({
      where: { id: otpRecord.id },
      data: { isUsed: true },
    });

    // Create session in DB
    const userAgent = req.headers.get("user-agent") || undefined;
    const sessionToken = await createStudentSession(otpRecord.user.id, userAgent);

    // Redirect to complete profile if not COMPLETED, else to student dashboard
    const user = otpRecord.user;
    const isCompleted =
      user &&
      (user.status === "COMPLETED" ||
        Boolean(user.name && user.name !== "Siswa Baru" && user.studentClass));

    if (user && isCompleted && user.status !== "COMPLETED") {
      await prisma.user.update({
        where: { id: user.id },
        data: { status: "COMPLETED" },
      }).catch(() => {});
    }

    const redirectParam = url.searchParams.get("redirect");

    let destination = isCompleted
      ? `${origin}/student`
      : `${origin}/student/complete-profile`;

    if (redirectParam && redirectParam.startsWith("/")) {
      destination = `${origin}${redirectParam}`;
    }

    const response = NextResponse.redirect(destination);
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
    return NextResponse.redirect(`${origin}/student/expired?reason=server_error`);
  }
}
