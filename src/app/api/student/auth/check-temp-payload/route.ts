import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createStudentSession } from "@/lib/student-auth";

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

      // Create session and set cookie
      const userAgent = req.headers.get("user-agent") || undefined;
      await createStudentSession(data.participantId, userAgent);

      return NextResponse.json({
        success: true,
        verified: true,
        redirectUrl: "/student",
      });
    }

    return NextResponse.json({ success: true, verified: false });
  } catch (err) {
    console.error("[CheckTempPayload] Error:", err);
    return NextResponse.json({ success: false, verified: false });
  }
}
