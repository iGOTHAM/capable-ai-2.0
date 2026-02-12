"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Loader2, Terminal, AlertCircle } from "lucide-react";

interface OnboardTerminalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function OnboardTerminal({ open, onOpenChange }: OnboardTerminalProps) {
  const terminalRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<
    "connecting" | "connected" | "error" | "closed"
  >("connecting");
  const [error, setError] = useState("");

  // Refs for cleanup
  const xtermRef = useRef<import("@xterm/xterm").Terminal | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const observerRef = useRef<ResizeObserver | null>(null);

  const cleanup = useCallback(() => {
    observerRef.current?.disconnect();
    observerRef.current = null;
    wsRef.current?.close();
    wsRef.current = null;
    xtermRef.current?.dispose();
    xtermRef.current = null;
  }, []);

  useEffect(() => {
    if (!open || !terminalRef.current) return;

    // Reset state on open
    setStatus("connecting");
    setError("");

    let cancelled = false;

    (async () => {
      // Dynamic imports (xterm needs DOM — can't run server-side)
      const [{ Terminal }, { FitAddon }, { WebLinksAddon }] = await Promise.all([
        import("@xterm/xterm"),
        import("@xterm/addon-fit"),
        import("@xterm/addon-web-links"),
      ]);

      if (cancelled || !terminalRef.current) return;

      // ─── Create terminal ───────────────────────────────────
      const term = new Terminal({
        theme: {
          background: "#1a1b26",
          foreground: "#c0caf5",
          cursor: "#c0caf5",
          cursorAccent: "#1a1b26",
          selectionBackground: "#33467c",
          selectionForeground: "#c0caf5",
          black: "#15161e",
          red: "#f7768e",
          green: "#9ece6a",
          yellow: "#e0af68",
          blue: "#7aa2f7",
          magenta: "#bb9af7",
          cyan: "#7dcfff",
          white: "#a9b1d6",
          brightBlack: "#414868",
          brightRed: "#f7768e",
          brightGreen: "#9ece6a",
          brightYellow: "#e0af68",
          brightBlue: "#7aa2f7",
          brightMagenta: "#bb9af7",
          brightCyan: "#7dcfff",
          brightWhite: "#c0caf5",
        },
        fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace",
        fontSize: 14,
        cursorBlink: true,
        convertEol: true,
        allowProposedApi: true,
      });

      const fitAddon = new FitAddon();
      const webLinksAddon = new WebLinksAddon();

      term.loadAddon(fitAddon);
      term.loadAddon(webLinksAddon);
      term.open(terminalRef.current);

      // Small delay so the container has rendered dimensions
      requestAnimationFrame(() => {
        fitAddon.fit();
      });

      xtermRef.current = term;

      // ─── WebSocket connection ──────────────────────────────
      const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
      const wsUrl = `${proto}//${window.location.host}/api/terminal/ws`;
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        if (cancelled) return;
        setStatus("connected");
        // Send initial resize
        ws.send(
          JSON.stringify({
            type: "resize",
            cols: term.cols,
            rows: term.rows,
          })
        );
      };

      ws.onmessage = (evt) => {
        term.write(typeof evt.data === "string" ? evt.data : new Uint8Array(evt.data));
      };

      ws.onerror = () => {
        if (cancelled) return;
        setStatus("error");
        setError("Failed to connect to terminal server.");
      };

      ws.onclose = (evt) => {
        if (cancelled) return;
        if (evt.code === 1008) {
          setError("Authentication failed. Try refreshing the page.");
          setStatus("error");
        } else if (evt.code === 1013) {
          setError("Another terminal session is already active. Close it first.");
          setStatus("error");
        } else if (status !== "error") {
          setStatus("closed");
        }
      };

      // Terminal input → WebSocket
      term.onData((data) => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(data);
        }
      });

      // ─── Resize handling ───────────────────────────────────
      const resizeObserver = new ResizeObserver(() => {
        fitAddon.fit();
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(
            JSON.stringify({
              type: "resize",
              cols: term.cols,
              rows: term.rows,
            })
          );
        }
      });
      resizeObserver.observe(terminalRef.current);
      observerRef.current = resizeObserver;
    })();

    return () => {
      cancelled = true;
      cleanup();
    };
  }, [open, cleanup]);

  // When dialog closes, ensure cleanup
  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      cleanup();
    }
    onOpenChange(newOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="flex h-[650px] max-w-4xl flex-col gap-0 p-0">
        <DialogHeader className="px-6 pb-3 pt-6">
          <div className="flex items-center gap-2">
            <Terminal className="h-4 w-4" />
            <DialogTitle>OpenClaw Onboarding Wizard</DialogTitle>
            <Badge variant="secondary" className="text-[10px]">
              Interactive
            </Badge>
          </div>
          <DialogDescription>
            Configure skills, security policies, model selection, and more
            through the interactive CLI wizard.
          </DialogDescription>
        </DialogHeader>

        {status === "error" && (
          <div className="mx-6 flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/5 p-3">
            <AlertCircle className="h-4 w-4 shrink-0 text-red-500" />
            <p className="text-sm text-red-400">{error}</p>
          </div>
        )}

        <div className="relative flex-1 px-6 pb-6 pt-2">
          <div
            ref={terminalRef}
            className="h-full w-full overflow-hidden rounded-lg border border-border"
            style={{ backgroundColor: "#1a1b26" }}
          />

          {status === "connecting" && (
            <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-[#1a1b26]/90">
              <div className="flex flex-col items-center gap-3">
                <Loader2 className="h-6 w-6 animate-spin text-blue-400" />
                <p className="text-sm text-slate-400">
                  Starting terminal session…
                </p>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
