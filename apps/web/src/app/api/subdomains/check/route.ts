import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";

const RESERVED_SUBDOMAINS = new Set([
  "www",
  "api",
  "app",
  "admin",
  "mail",
  "smtp",
  "imap",
  "pop",
  "ftp",
  "ssh",
  "dashboard",
  "status",
  "docs",
  "blog",
  "help",
  "support",
  "billing",
  "login",
  "auth",
  "test",
  "staging",
  "dev",
  "demo",
  "cdn",
  "assets",
  "static",
  "ns1",
  "ns2",
]);

const SUBDOMAIN_REGEX = /^[a-z0-9][a-z0-9-]*[a-z0-9]$/;

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const name = request.nextUrl.searchParams.get("name")?.toLowerCase().trim();

  if (!name) {
    return NextResponse.json(
      { error: "Missing name parameter" },
      { status: 400 },
    );
  }

  // Validate format
  if (name.length < 3 || name.length > 32) {
    return NextResponse.json({
      available: false,
      reason: "Must be 3-32 characters",
    });
  }

  if (!SUBDOMAIN_REGEX.test(name)) {
    return NextResponse.json({
      available: false,
      reason: "Only lowercase letters, numbers, and hyphens allowed",
    });
  }

  // Check reserved list
  if (RESERVED_SUBDOMAINS.has(name)) {
    return NextResponse.json({
      available: false,
      reason: "This name is reserved",
    });
  }

  // Check database uniqueness
  const existing = await db.deployment.findUnique({
    where: { subdomain: name },
  });

  if (existing) {
    return NextResponse.json({
      available: false,
      reason: "Already taken",
    });
  }

  return NextResponse.json({
    available: true,
    subdomain: name,
    preview: `${name}.capable.ai`,
  });
}
