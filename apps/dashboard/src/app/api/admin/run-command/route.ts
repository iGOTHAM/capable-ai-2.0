import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

const runCommandSchema = z.object({
  command: z.string().min(1).max(4000),
  timeout: z.number().min(1000).max(60000).optional().default(15000),
});

/**
 * POST /api/admin/run-command
 *
 * Execute a shell command on the deployment. Used for administrative
 * tasks like updating Caddy config, restarting services, etc.
 *
 * Headers: X-Admin-Secret: <secret>
 * Body: { command: string, timeout?: number }
 *
 * Response:
 *   200: { stdout: string, stderr: string, exitCode: number }
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

  const parsed = runCommandSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.errors[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }

  const { command, timeout } = parsed.data;

  try {
    const { stdout, stderr } = await execAsync(command, {
      timeout,
      maxBuffer: 1024 * 1024, // 1MB
    });
    return NextResponse.json({
      stdout: stdout.slice(0, 10000),
      stderr: stderr.slice(0, 10000),
      exitCode: 0,
    });
  } catch (err: unknown) {
    const execErr = err as {
      stdout?: string;
      stderr?: string;
      code?: number;
      message?: string;
    };
    return NextResponse.json({
      stdout: (execErr.stdout ?? "").slice(0, 10000),
      stderr: (execErr.stderr ?? execErr.message ?? "").slice(0, 10000),
      exitCode: execErr.code ?? 1,
    });
  }
}
