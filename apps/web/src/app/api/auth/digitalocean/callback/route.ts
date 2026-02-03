import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { encrypt } from "@/lib/encryption";
import { exchangeCodeForTokens, getAccount } from "@/lib/digitalocean";
import { cookies } from "next/headers";

/**
 * GET /api/auth/digitalocean/callback
 *
 * Handles the OAuth callback from DigitalOcean.
 * Exchanges the authorization code for tokens, encrypts them,
 * and stores the DigitalOceanAccount record.
 */
export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.redirect(
      new URL("/login", req.nextUrl.origin).toString(),
    );
  }

  const code = req.nextUrl.searchParams.get("code");
  const state = req.nextUrl.searchParams.get("state");
  const error = req.nextUrl.searchParams.get("error");

  // User denied access
  if (error) {
    const projectId = state?.split(":")[1] ?? "";
    const redirectUrl = projectId
      ? `/projects/${projectId}/deploy?do_error=access_denied`
      : "/projects?do_error=access_denied";
    return NextResponse.redirect(
      new URL(redirectUrl, req.nextUrl.origin).toString(),
    );
  }

  if (!code || !state) {
    return NextResponse.redirect(
      new URL("/projects?do_error=missing_params", req.nextUrl.origin).toString(),
    );
  }

  // Validate CSRF state
  const cookieStore = await cookies();
  const savedState = cookieStore.get("do_oauth_state")?.value;
  cookieStore.delete("do_oauth_state");

  if (!savedState || savedState !== state) {
    return NextResponse.redirect(
      new URL("/projects?do_error=invalid_state", req.nextUrl.origin).toString(),
    );
  }

  // Extract projectId from state
  const projectId = state.split(":")[1] ?? "";

  try {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const redirectUri = `${appUrl}/api/auth/digitalocean/callback`;

    // Exchange code for tokens
    const tokens = await exchangeCodeForTokens(code, redirectUri);

    // Get DO account info
    const account = await getAccount(tokens.access_token);

    // Calculate token expiry (DO tokens last 30 days)
    const tokenExpiresAt = new Date(
      Date.now() + tokens.expires_in * 1000,
    );

    // Encrypt tokens before storing
    const encryptedAccess = encrypt(tokens.access_token);
    const encryptedRefresh = encrypt(tokens.refresh_token);

    // Upsert the DigitalOceanAccount
    await db.digitalOceanAccount.upsert({
      where: { userId: user.id },
      create: {
        userId: user.id,
        accessToken: encryptedAccess,
        refreshToken: encryptedRefresh,
        tokenExpiresAt,
        doAccountEmail: account.email,
      },
      update: {
        accessToken: encryptedAccess,
        refreshToken: encryptedRefresh,
        tokenExpiresAt,
        doAccountEmail: account.email,
      },
    });

    // Redirect back to deploy page
    const redirectUrl = projectId
      ? `/projects/${projectId}/deploy?do_connected=true`
      : "/projects?do_connected=true";

    return NextResponse.redirect(
      new URL(redirectUrl, req.nextUrl.origin).toString(),
    );
  } catch (err) {
    console.error("DO OAuth callback error:", err);
    const redirectUrl = projectId
      ? `/projects/${projectId}/deploy?do_error=token_exchange`
      : "/projects?do_error=token_exchange";
    return NextResponse.redirect(
      new URL(redirectUrl, req.nextUrl.origin).toString(),
    );
  }
}
