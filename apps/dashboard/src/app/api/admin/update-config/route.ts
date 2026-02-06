import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { promises as fs } from "fs";
import path from "path";

const updateConfigSchema = z.object({
  skills: z
    .object({
      enabled: z.array(z.string()).optional(),
      disabled: z.array(z.string()).optional(),
    })
    .optional(),
});

/**
 * POST /api/admin/update-config
 *
 * Updates configuration on the running dashboard:
 * - Skills: Updates enabled/disabled skills in config
 *
 * Headers: X-Admin-Secret: <secret>
 * Body: { skills?: { enabled: [...], disabled: [...] } }
 *
 * Response:
 *   200: { success: true, changes: [...] }
 *   400: { error: "..." }
 *   401: { error: "Unauthorized" }
 *   500: { error: "..." }
 */
export async function POST(req: NextRequest) {
  // Validate admin secret
  const adminSecret = process.env.ADMIN_SECRET;
  if (!adminSecret) {
    return NextResponse.json(
      { error: "Admin secret not configured on this deployment" },
      { status: 500 }
    );
  }

  const providedSecret = req.headers.get("X-Admin-Secret");
  if (!providedSecret || providedSecret !== adminSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Parse request body
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = updateConfigSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.errors[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }

  const { skills } = parsed.data;
  const changes: string[] = [];

  try {
    // Handle skills change - update config file
    if (skills) {
      const configPath =
        process.env.CONFIG_FILE || "/root/.openclaw/openclaw.json";

      // Read existing config or create new
      let config: Record<string, unknown> = {};
      try {
        const existing = await fs.readFile(configPath, "utf-8");
        config = JSON.parse(existing);
      } catch {
        // Config doesn't exist yet, start fresh
      }

      // Update skills in config
      if (skills.enabled || skills.disabled) {
        config.skills = {
          ...(config.skills as Record<string, unknown> | undefined),
          enabled: skills.enabled ?? (config.skills as { enabled?: string[] })?.enabled ?? [],
          disabled: skills.disabled ?? (config.skills as { disabled?: string[] })?.disabled ?? [],
        };

        // Ensure config directory exists
        await fs.mkdir(path.dirname(configPath), { recursive: true });

        // Write updated config
        await fs.writeFile(
          configPath,
          JSON.stringify(config, null, 2),
          "utf-8"
        );
        changes.push("Skills configuration updated");
      }
    }

    if (changes.length === 0) {
      return NextResponse.json(
        { error: "No changes specified" },
        { status: 400 }
      );
    }

    return NextResponse.json({ success: true, changes });
  } catch (err) {
    console.error("Failed to update config:", err);
    return NextResponse.json(
      {
        error:
          err instanceof Error ? err.message : "Failed to update configuration",
      },
      { status: 500 }
    );
  }
}
