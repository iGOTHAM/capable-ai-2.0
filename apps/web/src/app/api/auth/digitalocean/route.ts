import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import crypto from "crypto";
import { cookies } from "next/headers";

/**
 * GET /api/auth/digitalocean
 *
 * Initiates the DigitalOcean OAuth flow.
 * Expects ?projectId=xxx to redirect back after auth.
 */
export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const clientId = process.env.DO_CLIENT_ID;
  if (!clientId) {
    return NextResponse.json(
      { error: "DigitalOcean OAuth not configured" },
      { status: 500 },
    );
  }

  const projectId = req.nextUrl.searchParams.get("projectId") ?? "";
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const redirectUri = `${appUrl}/api/auth/digitalocean/callback`;

  // Generate CSRF state token that encodes the projectId for redirect-back
  const stateToken = crypto.randomBytes(16).toString("hex");
  const state = `${stateToken}:${projectId}`;

  // Store state in cookie for validation in callback
  const cookieStore = await cookies();
  cookieStore.set("do_oauth_state", state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 600, // 10 minutes
    path: "/",
  });

  const authorizeUrl = new URL(
    "https://cloud.digitalocean.com/v1/oauth/authorize",
  );
  authorizeUrl.searchParams.set("client_id", clientId);
  authorizeUrl.searchParams.set("redirect_uri", redirectUri);
  authorizeUrl.searchParams.set("response_type", "code");
  authorizeUrl.searchParams.set("state", state);

  return NextResponse.redirect(authorizeUrl.toString());
}
