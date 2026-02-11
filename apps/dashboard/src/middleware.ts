import { NextRequest, NextResponse } from "next/server";

const publicPaths = ["/login", "/api/auth", "/api/admin", "/api/agent-public"];

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

/**
 * Constant-time string comparison using Web Crypto API (Edge Runtime compatible).
 * Prevents timing side-channel attacks on token validation.
 */
async function safeCompareEdge(a: string, b: string): Promise<boolean> {
  const enc = new TextEncoder();
  const keyData = enc.encode("timing-safe-compare-key");
  const key = await crypto.subtle.importKey(
    "raw",
    keyData,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const [sigA, sigB] = await Promise.all([
    crypto.subtle.sign("HMAC", key, enc.encode(a)),
    crypto.subtle.sign("HMAC", key, enc.encode(b)),
  ]);
  const bufA = new Uint8Array(sigA);
  const bufB = new Uint8Array(sigB);
  if (bufA.length !== bufB.length) return false;
  let result = 0;
  for (let i = 0; i < bufA.length; i++) {
    result |= (bufA[i] ?? 0) ^ (bufB[i] ?? 0);
  }
  return result === 0;
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

  // Validate the cookie by calling our Node.js API endpoint via localhost.
  //
  // Why not just use process.env.AUTH_PASSWORD here?
  //   Edge Runtime has its own process.env copy frozen at container start.
  //   When the password changes, only Node.js runtime sees the update.
  //
  // Why localhost instead of request.url?
  //   Using the external URL would route through Cloudflare → Caddy → back
  //   to the same process, which can fail or loop. Localhost goes direct.
  const port = process.env.PORT || "3100";
  try {
    const verifyUrl = `http://localhost:${port}/api/auth/verify`;
    const res = await fetch(verifyUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    });
    if (res.ok) {
      return NextResponse.next();
    }
  } catch {
    // If localhost verify fails, fall back to env-based check.
    // This works for the initial password (before any changes).
    const secret = process.env.AUTH_PASSWORD || "changeme";
    const expected = await makeExpectedToken(secret);
    const isValid = await safeCompareEdge(token, expected);
    if (isValid) {
      return NextResponse.next();
    }
  }

  // Clear stale/invalid cookie and redirect to login
  const response = NextResponse.redirect(new URL("/login", request.url));
  response.cookies.delete("dashboard_auth");
  return response;
}

export const config = {
  matcher: ["/((?!_next|favicon.ico).*)"],
};
