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
    const setting = await prisma.systemSetting.findUnique({
      where: { key: `login_payload:${token}` },
    });

    if (!setting) {
      return NextResponse.redirect(`${origin}/student/expired?reason=already_used`);
    }

    const data = JSON.parse(setting.value);

    // Cek kadaluwarsa
    if (new Date() > new Date(data.expiresAt)) {
      await prisma.systemSetting.delete({ where: { key: `login_payload:${token}` } }).catch(() => {});
      return NextResponse.redirect(`${origin}/student/expired?reason=expired`);
    }

    if (data.status === "VERIFIED" && data.participantId) {
      // Hapus token agar tidak bisa dipakai 2x
      await prisma.systemSetting.delete({ where: { key: `login_payload:${token}` } }).catch(() => {});

      // Fetch user to verify registration status
      const user = await prisma.user.findUnique({
        where: { id: data.participantId },
      });

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

      // Buat session cookie
      const userAgent = req.headers.get("user-agent") || undefined;
      const sessionToken = await createStudentSession(data.participantId, userAgent);

      const destination = isCompleted ? `${origin}/student` : `${origin}/student/complete-profile`;
      const response = NextResponse.redirect(destination);
      response.cookies.set(STUDENT_COOKIE_NAME, sessionToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 30 * 24 * 60 * 60,
        path: "/",
      });

      return response;
    }

    return NextResponse.redirect(`${origin}/student/expired?reason=not_verified`);
  } catch (err) {
    console.error("[VerifyRegistration] Error:", err);
    return NextResponse.redirect(`${origin}/student/expired?reason=server_error`);
  }
}
