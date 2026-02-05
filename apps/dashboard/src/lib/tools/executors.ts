/**
 * Tool executors for web_search, fetch_url, read_file, and write_file.
 * No API keys required — uses Brave Search HTML scraping + SearXNG fallback.
 */

import { promises as fs } from "fs";
import pathModule from "path";

const MAX_CONTENT_LENGTH = 12000; // chars — keep tool results reasonable for context window
const WORKSPACE = process.env.OPENCLAW_DIR || "/root/.openclaw";

// --- SSRF protection ---

const PRIVATE_IP_PATTERNS = [
  /^127\./,
  /^10\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^192\.168\./,
  /^0\./,
  /^169\.254\./,
  /^fc00:/i,
  /^fd/i,
  /^fe80:/i,
  /^::1$/,
  /^localhost$/i,
];

function isPrivateHost(hostname: string): boolean {
  return PRIVATE_IP_PATTERNS.some((p) => p.test(hostname));
}

function validateUrl(urlStr: string): URL {
  let url: URL;
  try {
    url = new URL(urlStr);
  } catch {
    throw new Error(`Invalid URL: ${urlStr}`);
  }

  if (!["http:", "https:"].includes(url.protocol)) {
    throw new Error(`Blocked protocol: ${url.protocol} — only http/https allowed`);
  }

  if (isPrivateHost(url.hostname)) {
    throw new Error(`Blocked: cannot fetch private/internal addresses`);
  }

  return url;
}

// --- HTML to text ---

function htmlToText(html: string): string {
  // Remove script, style, and head
  let text = html.replace(/<(script|style|head)[^>]*>[\s\S]*?<\/\1>/gi, "");
  // Replace block elements with newlines
  text = text.replace(/<\/(p|div|h[1-6]|li|tr|br\s*\/?)>/gi, "\n");
  text = text.replace(/<br\s*\/?>/gi, "\n");
  // Strip remaining tags
  text = text.replace(/<[^>]+>/g, "");
  // Decode common HTML entities
  text = text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ");
  // Collapse whitespace
  text = text.replace(/[ \t]+/g, " ");
  text = text.replace(/\n{3,}/g, "\n\n");
  return text.trim();
}

// --- Web Search ---

interface SearchResult {
  title: string;
  url: string;
  snippet: string;
}

const BROWSER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

/** Brave Search HTML scraping — works reliably from datacenter IPs */
async function searchBrave(query: string): Promise<SearchResult[]> {
  try {
    const braveUrl = `https://search.brave.com/search?q=${encodeURIComponent(query)}`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    const res = await fetch(braveUrl, {
      signal: controller.signal,
      headers: {
        "User-Agent": BROWSER_UA,
        Accept: "text/html",
      },
    });
    clearTimeout(timeout);

    if (!res.ok) return [];

    const html = await res.text();
    const results: SearchResult[] = [];

    // Split HTML by snippet blocks (Brave uses Svelte classes)
    const parts = html.split(/class="snippet\s+svelte/);

    for (let i = 1; i < parts.length && results.length < 8; i++) {
      const part = parts[i];
      if (!part) continue;
      const block = part.slice(0, 3000);

      // Extract title from snippet-title's title attribute
      const titleMatch = block.match(/snippet-title[^"]*"[^>]*title="([^"]+)"/);
      if (!titleMatch?.[1]) continue;

      // Extract first external URL in the block
      const urlMatch = block.match(/href="(https?:\/\/(?!search\.brave|brave\.com|cdn\.brave)[^"]+)"/);
      if (!urlMatch?.[1]) continue;

      results.push({
        title: htmlToText(titleMatch[1]),
        url: urlMatch[1].replace(/&amp;/g, "&"),
        snippet: "",
      });
    }

    return results;
  } catch {
    return [];
  }
}

/** SearXNG public instances as fallback (JSON API) */
const SEARXNG_INSTANCES = [
  "https://search.sapti.me",
  "https://searxng.site",
  "https://search.bus-hit.me",
];

async function searchSearXNG(query: string): Promise<SearchResult[]> {
  for (const instance of SEARXNG_INSTANCES) {
    try {
      const url = `${instance}/search?q=${encodeURIComponent(query)}&format=json&categories=general`;
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);

      const res = await fetch(url, {
        signal: controller.signal,
        headers: {
          Accept: "application/json",
          "User-Agent": BROWSER_UA,
        },
      });
      clearTimeout(timeout);

      if (!res.ok) continue;

      const data = (await res.json()) as {
        results?: Array<{ title?: string; url?: string; content?: string }>;
      };

      if (!data.results?.length) continue;

      return data.results.slice(0, 8).map((r) => ({
        title: r.title || "",
        url: r.url || "",
        snippet: r.content || "",
      }));
    } catch {
      continue;
    }
  }
  return [];
}

export async function executeWebSearch(query: string): Promise<string> {
  // Try Brave Search first (best for datacenter IPs), then SearXNG
  let results = await searchBrave(query);

  if (results.length === 0) {
    results = await searchSearXNG(query);
  }

  if (results.length === 0) {
    return "No search results found. The search engines may be temporarily unavailable.";
  }

  return results
    .map((r, i) => `${i + 1}. **${r.title}**\n   ${r.url}${r.snippet ? `\n   ${r.snippet}` : ""}`)
    .join("\n\n");
}

// --- URL Fetch ---

export async function executeFetchUrl(urlStr: string): Promise<string> {
  const url = validateUrl(urlStr);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);

  try {
    const res = await fetch(url.toString(), {
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; CapableBot/1.0)",
        Accept: "text/html, application/json, text/plain",
      },
      redirect: "follow",
    });

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    }

    const contentType = res.headers.get("content-type") || "";
    const raw = await res.text();

    let text: string;
    if (contentType.includes("application/json")) {
      // Pretty-print JSON
      try {
        text = JSON.stringify(JSON.parse(raw), null, 2);
      } catch {
        text = raw;
      }
    } else if (contentType.includes("text/html")) {
      text = htmlToText(raw);
    } else {
      text = raw;
    }

    if (text.length > MAX_CONTENT_LENGTH) {
      text = text.slice(0, MAX_CONTENT_LENGTH) + "\n\n[Content truncated]";
    }

    return text || "Page returned empty content.";
  } finally {
    clearTimeout(timeout);
  }
}

// --- File operations ---

/**
 * Resolve a relative path to an absolute path within workspace.
 * Prevents path traversal attacks.
 */
function resolveWorkspacePath(relativePath: string): string {
  // Normalize and resolve
  const resolved = pathModule.resolve(
    pathModule.join(WORKSPACE, "workspace", relativePath),
  );
  const workspaceRoot = pathModule.resolve(
    pathModule.join(WORKSPACE, "workspace"),
  );

  // Ensure the resolved path is still within workspace
  if (!resolved.startsWith(workspaceRoot + pathModule.sep) && resolved !== workspaceRoot) {
    throw new Error("Path traversal detected — access denied");
  }

  return resolved;
}

export async function executeReadFile(relativePath: string): Promise<string> {
  const absPath = resolveWorkspacePath(relativePath);
  const ext = pathModule.extname(absPath).toLowerCase();

  try {
    if (ext === ".pdf") {
      // For PDFs, try to extract text via pdf-parse (optional dep).
      try {
        // Dynamic require to avoid type errors when pdf-parse isn't installed
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const pdfParse = require("pdf-parse") as (buf: Buffer) => Promise<{ text: string }>;
        const buffer = await fs.readFile(absPath);
        const data = await pdfParse(buffer);
        let text = data.text || "";
        if (text.length > MAX_CONTENT_LENGTH) {
          text = text.slice(0, MAX_CONTENT_LENGTH) + "\n\n[Content truncated]";
        }
        return text || "PDF appears to be empty or contains only images.";
      } catch {
        // pdf-parse not installed — return file info
        const stat = await fs.stat(absPath);
        return `[PDF file: ${pathModule.basename(absPath)}, ${(stat.size / 1024).toFixed(1)}KB. Install pdf-parse for text extraction.]`;
      }
    }

    // Text-based formats
    const content = await fs.readFile(absPath, "utf-8");
    if (content.length > MAX_CONTENT_LENGTH) {
      return content.slice(0, MAX_CONTENT_LENGTH) + "\n\n[Content truncated]";
    }
    return content || "File is empty.";
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      return `File not found: ${relativePath}`;
    }
    throw err;
  }
}

export async function executeWriteFile(
  relativePath: string,
  content: string,
): Promise<string> {
  // Only allow writing to deals/ directory
  if (!relativePath.startsWith("deals/")) {
    return "Error: Can only write files to the deals/ directory.";
  }

  const absPath = resolveWorkspacePath(relativePath);

  // Create directory if needed
  await fs.mkdir(pathModule.dirname(absPath), { recursive: true });
  await fs.writeFile(absPath, content, "utf-8");

  return `File written: ${relativePath} (${content.length} characters)`;
}

// --- Executor dispatcher ---

export async function executeTool(
  name: string,
  args: Record<string, string | undefined>,
): Promise<string> {
  switch (name) {
    case "web_search":
      if (!args.query) return "Error: query is required for web_search";
      return executeWebSearch(args.query);
    case "fetch_url":
      if (!args.url) return "Error: url is required for fetch_url";
      return executeFetchUrl(args.url);
    case "read_file":
      if (!args.path) return "Error: path is required for read_file";
      return executeReadFile(args.path);
    case "write_file":
      if (!args.path) return "Error: path is required for write_file";
      if (!args.content) return "Error: content is required for write_file";
      return executeWriteFile(args.path, args.content);
    default:
      return `Unknown tool: ${name}`;
  }
}
