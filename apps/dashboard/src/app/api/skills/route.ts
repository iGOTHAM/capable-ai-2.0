import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";
import { getInstalledSkills, installSkill, uninstallSkill } from "@/lib/skills";
import { logDashboardEvent } from "@/lib/events";

export const dynamic = "force-dynamic";

/** GET /api/skills — list all skills with installed status */
export async function GET() {
  const authed = await verifyAuth();
  if (!authed) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const skills = await getInstalledSkills();
    return NextResponse.json({ skills });
  } catch (err) {
    console.error("Failed to list skills:", err);
    return NextResponse.json({ skills: [] });
  }
}

/** POST /api/skills — install a skill */
export async function POST(request: NextRequest) {
  const authed = await verifyAuth();
  if (!authed) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { skillId } = await request.json();
    if (!skillId || typeof skillId !== "string") {
      return NextResponse.json({ error: "Missing skillId" }, { status: 400 });
    }

    const success = await installSkill(skillId);
    if (!success) {
      return NextResponse.json({ error: "Skill not found" }, { status: 404 });
    }

    await logDashboardEvent("tool.called", `User installed skill: ${skillId}`, {
      action: "skill.installed",
      skillId,
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Failed to install skill:", err);
    return NextResponse.json(
      { error: "Failed to install skill" },
      { status: 500 },
    );
  }
}

/** DELETE /api/skills — uninstall a skill */
export async function DELETE(request: NextRequest) {
  const authed = await verifyAuth();
  if (!authed) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const skillId = searchParams.get("id");
    if (!skillId) {
      return NextResponse.json({ error: "Missing id" }, { status: 400 });
    }

    const success = await uninstallSkill(skillId);
    if (!success) {
      return NextResponse.json({ error: "Skill not found" }, { status: 404 });
    }

    await logDashboardEvent("tool.called", `User uninstalled skill: ${skillId}`, {
      action: "skill.uninstalled",
      skillId,
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Failed to uninstall skill:", err);
    return NextResponse.json(
      { error: "Failed to uninstall skill" },
      { status: 500 },
    );
  }
}
