import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth";

/**
 * POST /api/auth/verify
 *
 * Internal endpoint called by middleware to validate a dashboard_auth cookie.
 * This runs in Node.js runtime where process.env.AUTH_PASSWORD is always
 * up-to-date (unlike Edge Runtime middleware which has a stale copy).
 *
 * Body: { "token": "<cookie-value>" }
 * Response: 200 if valid, 401 if invalid
 */
export async function POST(req: NextRequest) {
  try {
    const { token } = await req.json();
    if (!token || typeof token !== "string") {
      return NextResponse.json({ valid: false }, { status: 401 });
    }

    if (verifyToken(token)) {
      return NextResponse.json({ valid: true });
    }

    return NextResponse.json({ valid: false }, { status: 401 });
  } catch {
    return NextResponse.json({ valid: false }, { status: 401 });
  }
}
