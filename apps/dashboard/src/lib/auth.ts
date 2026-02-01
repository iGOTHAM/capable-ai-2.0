import { createHmac } from "crypto";
import { cookies } from "next/headers";

const COOKIE_NAME = "dashboard_auth";
const AUTH_SECRET = process.env.AUTH_PASSWORD || "changeme";

function makeToken(): string {
  return createHmac("sha256", AUTH_SECRET).update("dashboard-auth").digest("hex");
}

export async function verifyAuth(): Promise<boolean> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return false;
  return token === makeToken();
}

export async function setAuthCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, makeToken(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 30 * 24 * 60 * 60, // 30 days
    path: "/",
  });
}

export function checkPassword(password: string): boolean {
  return password === AUTH_SECRET;
}
