import { prisma } from "./prisma";
import crypto from "crypto";
import { cookies } from "next/headers";

export const STUDENT_COOKIE_NAME = "velo_student_session";

/**
 * Generates a random 6-digit numeric OTP code (e.g., "849201")
 */
export function generateOtpCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

/**
 * Generates a random crypto hex token for Magic Login Link
 */
export function generateMagicToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

/**
 * Creates a new StudentSession record and sets HTTP-Only Cookie
 */
export async function createStudentSession(
  participantId: string,
  userAgent?: string,
  ipAddress?: string
): Promise<string> {
  const sessionToken = crypto.randomBytes(40).toString("hex");
  // Expire session in 30 days
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

  await prisma.studentSession.create({
    data: {
      userId: participantId,
      sessionToken,
      userAgent: userAgent || null,
      ipAddress: ipAddress || null,
      expiresAt,
    },
  });

  // Set HTTP-Only Cookie
  const cookieStore = await cookies();
  cookieStore.set(STUDENT_COOKIE_NAME, sessionToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    expires: expiresAt,
    path: "/",
  });

  return sessionToken;
}

/**
 * Validates current Student Session Cookie and returns logged-in Participant
 */
export async function getLoggedInStudent() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(STUDENT_COOKIE_NAME)?.value;

    if (!token) return null;

    const session = await prisma.studentSession.findUnique({
      where: { sessionToken: token },
      include: {
        user: true,
      },
    });

    if (!session || !session.user) return null;

    // Check expiration
    if (new Date() > new Date(session.expiresAt)) {
      await prisma.studentSession.delete({ where: { id: session.id } }).catch(() => {});
      return null;
    }

    // Check if participant is excluded or not completed
    if (session.user.isExcluded) return null;

    return session.user;
  } catch (err) {
    console.error("[StudentAuth] Error verifying session:", err);
    return null;
  }
}

/**
 * Clears Student Session Cookie and deletes DB session
 */
export async function logoutStudent() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(STUDENT_COOKIE_NAME)?.value;

    if (token) {
      await prisma.studentSession.delete({ where: { sessionToken: token } }).catch(() => {});
    }

    cookieStore.delete(STUDENT_COOKIE_NAME);
  } catch (err) {
    console.error("[StudentAuth] Logout error:", err);
  }
}
