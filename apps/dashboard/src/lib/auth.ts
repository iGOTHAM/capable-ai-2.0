import { createHmac, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";

const COOKIE_NAME = "dashboard_auth";

/** Read AUTH_PASSWORD dynamically so in-process updates take effect immediately */
function getAuthSecret(): string {
  return process.env.AUTH_PASSWORD || "changeme";
}

/**
 * Constant-time string comparison to prevent timing side-channel attacks.
 * Always compares full length regardless of where strings differ.
 */
export function safeCompare(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) {
    // Compare a with itself to maintain constant time, then return false
    timingSafeEqual(bufA, bufA);
    return false;
  }
  return timingSafeEqual(bufA, bufB);
}

function makeToken(): string {
  return createHmac("sha256", getAuthSecret()).update("dashboard-auth").digest("hex");
}

export async function verifyAuth(): Promise<boolean> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return false;
  return safeCompare(token, makeToken());
}

export async function setAuthCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, makeToken(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 7 * 24 * 60 * 60, // 7 days
    path: "/",
  });
}

export function checkPassword(password: string): boolean {
  return safeCompare(password, getAuthSecret());
}

/** Verify a dashboard_auth cookie token against the current password */
export function verifyToken(token: string): boolean {
  return safeCompare(token, makeToken());
}
