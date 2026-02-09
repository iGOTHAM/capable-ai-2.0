import { NextRequest, NextResponse } from "next/server";

const publicPaths = ["/login", "/api/auth", "/api/admin"];

/**
 * Compute HMAC-SHA256 using Web Crypto API (Edge Runtime compatible).
 * Must match the Node.js createHmac("sha256", secret).update("dashboard-auth").digest("hex")
 * used in lib/auth.ts.
 */
async function makeExpectedToken(secret: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode("dashboard-auth"));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (publicPaths.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  const token = request.cookies.get("dashboard_auth")?.value;
  if (!token) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // Validate the HMAC token matches the current AUTH_PASSWORD
  const secret = process.env.AUTH_PASSWORD || "changeme";
  const expected = await makeExpectedToken(secret);
  if (token !== expected) {
    // Clear stale/invalid cookie and redirect to login
    const response = NextResponse.redirect(
      new URL("/login", request.url),
    );
    response.cookies.delete("dashboard_auth");
    return response;
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next|favicon.ico).*)"],
};
