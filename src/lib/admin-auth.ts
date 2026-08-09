import { cookies } from "next/headers";
import crypto from "crypto";
import { prisma } from "./prisma";

export const ADMIN_COOKIE_NAME = "velo_admin_session";

/**
 * Creates an Admin Session and sets HTTP-Only Cookie
 */
export async function createAdminSession(username: string): Promise<string> {
  const sessionToken = crypto.randomBytes(40).toString("hex");
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

  await prisma.systemSetting.upsert({
    where: { key: `admin_session:${sessionToken}` },
    create: {
      key: `admin_session:${sessionToken}`,
      value: JSON.stringify({
        username,
        expiresAt: expiresAt.toISOString(),
      }),
    },
    update: {
      value: JSON.stringify({
        username,
        expiresAt: expiresAt.toISOString(),
      }),
    },
  });

  const cookieStore = await cookies();
  cookieStore.set(ADMIN_COOKIE_NAME, sessionToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    expires: expiresAt,
    path: "/",
  });

  return sessionToken;
}

/**
 * Checks if current request has a valid Admin Session Cookie
 */
export async function getLoggedInAdmin() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(ADMIN_COOKIE_NAME)?.value;

    if (!token) return null;

    const setting = await prisma.systemSetting.findUnique({
      where: { key: `admin_session:${token}` },
    });

    if (!setting) return null;

    const data = JSON.parse(setting.value);
    if (new Date() > new Date(data.expiresAt)) {
      await prisma.systemSetting.delete({ where: { key: `admin_session:${token}` } }).catch(() => {});
      return null;
    }

    return { username: data.username || "admin" };
  } catch (err) {
    console.error("[AdminAuth] Error verifying admin session:", err);
    return null;
  }
}

/**
 * Destroys Admin Session Cookie and deletes DB setting
 */
export async function logoutAdmin() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(ADMIN_COOKIE_NAME)?.value;

    if (token) {
      await prisma.systemSetting.delete({ where: { key: `admin_session:${token}` } }).catch(() => {});
    }

    cookieStore.delete(ADMIN_COOKIE_NAME);
  } catch (err) {
    console.error("[AdminAuth] Admin logout error:", err);
  }
}
