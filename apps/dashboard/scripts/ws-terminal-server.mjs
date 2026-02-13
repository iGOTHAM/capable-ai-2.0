/**
 * WebSocket Terminal Server
 *
 * Bridges xterm.js (browser) ↔ node-pty (server) over WebSocket.
 * Runs as a sidecar process alongside the Next.js dashboard.
 *
 * - Listens on WS_TERMINAL_PORT (default 3101)
 * - Authenticates via ?token= query param (HMAC cookie value)
 * - Re-reads AUTH_PASSWORD from disk on each connection (supports live password changes)
 * - Spawns a bash shell via node-pty, piping I/O over WebSocket
 */

import { readFileSync } from "fs";
import { createHmac } from "crypto";
import { WebSocketServer } from "ws";
import pty from "node-pty";

const PORT = parseInt(process.env.WS_TERMINAL_PORT || "3101", 10);
const ENV_FILE = process.env.ENV_FILE || "/opt/capable/.env";

/**
 * Read AUTH_PASSWORD from the .env file on disk.
 * This ensures we pick up password changes without restarting.
 */
function getAuthPassword() {
  try {
    const content = readFileSync(ENV_FILE, "utf-8");
    for (const line of content.split("\n")) {
      const trimmed = line.trim();
      if (trimmed.startsWith("AUTH_PASSWORD=")) {
        return trimmed.slice("AUTH_PASSWORD=".length).replace(/^["']|["']$/g, "");
      }
    }
  } catch {
    // Fall back to env var if file read fails
  }
  return process.env.AUTH_PASSWORD || "";
}

/**
 * Verify the auth token from the WebSocket query string.
 * The token is an HMAC-SHA256 of "authenticated" using the password as key.
 */
function verifyToken(token) {
  const password = getAuthPassword();
  if (!password) return false;
  const expected = createHmac("sha256", password).update("authenticated").digest("hex");
  return token === expected;
}

const wss = new WebSocketServer({ port: PORT });

console.log(`[terminal] WebSocket terminal server listening on 0.0.0.0:${PORT}`);

wss.on("connection", (ws, req) => {
  // Extract token from query string
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const token = url.searchParams.get("token");

  if (!verifyToken(token)) {
    console.log("[terminal] Authentication failed");
    ws.send("\r\n\x1b[31mAuthentication failed.\x1b[0m\r\n");
    ws.close(4001, "Authentication failed");
    return;
  }

  console.log("[terminal] Client connected, spawning shell");

  // Determine container mode for exec-ing into OpenClaw
  const containerMode = process.env.CONTAINER_MODE;
  let shell, args;

  if (containerMode === "docker") {
    // Exec into the OpenClaw Docker container
    shell = "docker";
    args = ["exec", "-it", "openclaw", "/bin/bash"];
  } else {
    // Direct shell access
    shell = process.env.SHELL || "/bin/bash";
    args = [];
  }

  const term = pty.spawn(shell, args, {
    name: "xterm-256color",
    cols: 80,
    rows: 24,
    cwd: process.env.HOME || "/root",
    env: { ...process.env, TERM: "xterm-256color" },
  });

  // Terminal → WebSocket
  term.onData((data) => {
    try {
      ws.send(data);
    } catch {
      // Client disconnected
    }
  });

  // WebSocket → Terminal
  ws.on("message", (data) => {
    const msg = data.toString();

    // Handle resize messages (JSON: {"type":"resize","cols":N,"rows":N})
    try {
      const parsed = JSON.parse(msg);
      if (parsed.type === "resize" && parsed.cols && parsed.rows) {
        term.resize(parsed.cols, parsed.rows);
        return;
      }
    } catch {
      // Not JSON, treat as terminal input
    }

    term.write(msg);
  });

  // Cleanup
  ws.on("close", () => {
    console.log("[terminal] Client disconnected");
    term.kill();
  });

  term.onExit(() => {
    console.log("[terminal] Shell exited");
    ws.close();
  });
});
