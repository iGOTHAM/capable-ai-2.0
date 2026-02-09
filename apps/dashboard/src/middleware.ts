import { createHmac } from "crypto";
import { NextRequest, NextResponse } from "next/server";

const publicPaths = ["/login", "/api/auth", "/api/admin"];

function isValidToken(token: string): boolean {
  const secret = process.env.AUTH_PASSWORD || "changeme";
  const expected = createHmac("sha256", secret)
    .update("dashboard-auth")
    .digest("hex");
  return token === expected;
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (publicPaths.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  const token = request.cookies.get("dashboard_auth")?.value;
  if (!token || !isValidToken(token)) {
    // Clear stale cookie if it exists but is invalid
    const response = NextResponse.redirect(
      new URL("/login", request.url),
    );
    if (token) {
      response.cookies.delete("dashboard_auth");
    }
    return response;
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next|favicon.ico).*)"],
};
