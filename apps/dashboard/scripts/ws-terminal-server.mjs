// =========================================
// Capable.ai — WebSocket Terminal Server
// =========================================
// Sidecar server that bridges xterm.js (browser) to a PTY running
// `openclaw onboard` inside the OpenClaw container.
//
// Runs alongside Next.js on a separate port (default 3101).
// Caddy routes /api/terminal/ws → this server.
// =========================================

import { createServer } from "http";
import { createHmac, timingSafeEqual } from "crypto";
import { readFileSync } from "fs";
import { WebSocketServer } from "ws";
import pty from "node-pty";

const PORT = parseInt(process.env.WS_TERMINAL_PORT || "3101", 10);
const IS_DOCKER = process.env.CONTAINER_MODE === "docker";
const MAX_SESSION_MS = 10 * 60 * 1000; // 10 minutes

// Path to env file where AUTH_PASSWORD is persisted on disk.
// The password change API (set-password route) writes here, and since
// the terminal server runs as a separate process from Next.js, we must
// re-read from disk on each connection to pick up password changes.
const ENV_FILE = IS_DOCKER ? "/opt/capable/.env" : "/etc/capable-dashboard.env";

// ─── Auth (mirrors lib/auth.ts) ─────────────────────────────────────────────

function getAuthPassword() {
  // Re-read from env file on every call so password changes are picked up
  // without restarting the terminal server process.
  try {
    const content = readFileSync(ENV_FILE, "utf-8");
    const match = content.match(/^AUTH_PASSWORD=(.+)$/m);
    if (match) return match[1].trim();
  } catch {
    // File doesn't exist or can't be read — fall through to process.env
  }
  return process.env.AUTH_PASSWORD || "changeme";
}

function makeToken(secret) {
  return createHmac("sha256", secret).update("dashboard-auth").digest("hex");
}

function validateCookie(req) {
  const cookieHeader = req.headers.cookie || "";
  const match = cookieHeader.match(/dashboard_auth=([^;]+)/);
  if (!match) return false;

  const token = match[1];
  const expected = makeToken(getAuthPassword());

  const bufA = Buffer.from(token);
  const bufB = Buffer.from(expected);
  if (bufA.length !== bufB.length) {
    timingSafeEqual(bufA, bufA); // constant-time even on length mismatch
    return false;
  }
  return timingSafeEqual(bufA, bufB);
}

// ─── Server ──────────────────────────────────────────────────────────────────

let activePty = null;
let activeWs = null;
let sessionTimer = null;

const server = createServer((_req, res) => {
  res.writeHead(200, { "Content-Type": "text/plain" });
  res.end("Terminal WebSocket server\n");
});

const wss = new WebSocketServer({ server });

wss.on("connection", (ws, req) => {
  // Auth check
  if (!validateCookie(req)) {
    ws.close(1008, "Unauthorized");
    return;
  }

  // Mutex — only one session at a time
  if (activePty) {
    ws.close(1013, "Another terminal session is already active");
    return;
  }

  console.log("[terminal] New session started");

  // Spawn PTY
  const cmd = IS_DOCKER ? "docker" : "openclaw";
  const args = IS_DOCKER
    ? ["exec", "-it", "capable-openclaw", "openclaw", "onboard"]
    : ["onboard"];

  let ptyProcess;
  try {
    ptyProcess = pty.spawn(cmd, args, {
      name: "xterm-256color",
      cols: 80,
      rows: 24,
      cwd: "/",
      env: process.env,
    });
  } catch (err) {
    console.error("[terminal] Failed to spawn PTY:", err.message);
    ws.send(`\r\nError: Failed to start onboarding wizard.\r\n${err.message}\r\n`);
    ws.close(1011, "PTY spawn failed");
    return;
  }

  activePty = ptyProcess;
  activeWs = ws;

  // PTY → WebSocket
  ptyProcess.onData((data) => {
    if (ws.readyState === ws.OPEN) {
      ws.send(data);
    }
  });

  // WebSocket → PTY
  ws.on("message", (msg) => {
    const str = msg.toString();

    // Check for resize commands (JSON)
    try {
      const parsed = JSON.parse(str);
      if (parsed.type === "resize" && parsed.cols && parsed.rows) {
        ptyProcess.resize(
          Math.max(1, Math.min(500, parsed.cols)),
          Math.max(1, Math.min(200, parsed.rows))
        );
        return;
      }
    } catch {
      // Not JSON — treat as stdin
    }

    ptyProcess.write(str);
  });

  // Cleanup helper
  const cleanup = () => {
    if (sessionTimer) {
      clearTimeout(sessionTimer);
      sessionTimer = null;
    }
    activePty = null;
    activeWs = null;
    try {
      ptyProcess.kill();
    } catch {
      /* already dead */
    }
    try {
      if (ws.readyState === ws.OPEN) ws.close();
    } catch {
      /* already closed */
    }
    console.log("[terminal] Session ended");
  };

  ptyProcess.onExit(({ exitCode }) => {
    console.log(`[terminal] PTY exited with code ${exitCode}`);
    if (ws.readyState === ws.OPEN) {
      ws.send(`\r\n[Process exited with code ${exitCode}]\r\n`);
    }
    cleanup();
  });

  ws.on("close", () => {
    console.log("[terminal] WebSocket closed");
    cleanup();
  });

  ws.on("error", (err) => {
    console.error("[terminal] WebSocket error:", err.message);
    cleanup();
  });

  // Safety timeout
  sessionTimer = setTimeout(() => {
    console.log("[terminal] Session timed out");
    if (ws.readyState === ws.OPEN) {
      ws.send("\r\n\x1b[33m[Session timed out after 10 minutes]\x1b[0m\r\n");
    }
    cleanup();
  }, MAX_SESSION_MS);
});

// ─── Start ───────────────────────────────────────────────────────────────────

server.listen(PORT, "0.0.0.0", () => {
  console.log(`[terminal] WebSocket terminal server listening on 0.0.0.0:${PORT}`);
});
