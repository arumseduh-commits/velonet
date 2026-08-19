import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createStudentSession, STUDENT_COOKIE_NAME } from "@/lib/student-auth";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const payloadId = url.searchParams.get("payloadId");

    if (!payloadId) {
      return NextResponse.json({ success: false, verified: false });
    }

    const setting = await prisma.systemSetting.findUnique({
      where: { key: `login_payload:${payloadId}` },
    });

    if (!setting) {
      return NextResponse.json({ success: false, verified: false });
    }

    const data = JSON.parse(setting.value);

    // Check expiration
    if (new Date() > new Date(data.expiresAt)) {
      await prisma.systemSetting.delete({ where: { key: `login_payload:${payloadId}` } }).catch(() => {});
      return NextResponse.json({ success: false, verified: false, expired: true });
    }

    if (data.status === "VERIFIED" && data.participantId) {
      // Delete used payload
      await prisma.systemSetting.delete({ where: { key: `login_payload:${payloadId}` } }).catch(() => {});

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

      // Create session and set cookie
      const userAgent = req.headers.get("user-agent") || undefined;
      const sessionToken = await createStudentSession(data.participantId, userAgent);

      const redirectUrl = isCompleted ? "/student" : "/student/complete-profile";

      const response = NextResponse.json({
        success: true,
        verified: true,
        redirectUrl,
      });

      response.cookies.set(STUDENT_COOKIE_NAME, sessionToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 30 * 24 * 60 * 60,
        path: "/",
      });

      return response;
    }

    return NextResponse.json({ success: true, verified: false });
  } catch (err) {
    console.error("[CheckTempPayload] Error:", err);
    return NextResponse.json({ success: false, verified: false });
  }
}
