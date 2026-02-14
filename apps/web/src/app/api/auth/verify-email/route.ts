import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { createSession } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token");

  if (!token) {
    return NextResponse.redirect(
      new URL("/verify-email?error=missing_token", request.url),
    );
  }

  const verificationToken = await db.verificationToken.findUnique({
    where: { token },
  });

  if (
    !verificationToken ||
    verificationToken.type !== "email_verification"
  ) {
    return NextResponse.redirect(
      new URL("/verify-email?error=invalid_token", request.url),
    );
  }

  if (verificationToken.expiresAt < new Date()) {
    await db.verificationToken.delete({ where: { token } });
    return NextResponse.redirect(
      new URL(
        `/verify-email?error=expired&email=${encodeURIComponent(verificationToken.identifier)}`,
        request.url,
      ),
    );
  }

  const email = verificationToken.identifier;

  // Mark email as verified
  const user = await db.user.update({
    where: { email },
    data: { emailVerified: new Date() },
  });

  // Delete the used token
  await db.verificationToken.delete({ where: { token } });

  // Create session and redirect to projects
  await createSession(user.id);

  return NextResponse.redirect(
    new URL("/projects?verified=true", request.url),
  );
}
