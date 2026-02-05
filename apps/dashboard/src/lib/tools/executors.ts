/**
 * Tool executors for web_search and fetch_url.
 * No API keys required — uses DuckDuckGo HTML and built-in fetch.
 */

const MAX_CONTENT_LENGTH = 12000; // chars — keep tool results reasonable for context window

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

// --- Web Search (DuckDuckGo HTML) ---

interface SearchResult {
  title: string;
  url: string;
  snippet: string;
}

export async function executeWebSearch(query: string): Promise<string> {
  const ddgUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;

  const res = await fetch(ddgUrl, {
    headers: {
      "User-Agent": "Mozilla/5.0 (compatible; CapableBot/1.0)",
    },
  });

  if (!res.ok) {
    throw new Error(`DuckDuckGo search failed: ${res.status}`);
  }

  const html = await res.text();

  // Parse results from DuckDuckGo HTML response
  const results: SearchResult[] = [];
  const resultRegex = /<a[^>]+class="result__a"[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi;
  const snippetRegex = /<a[^>]+class="result__snippet"[^>]*>([\s\S]*?)<\/a>/gi;

  const titleMatches = [...html.matchAll(resultRegex)];
  const snippetMatches = [...html.matchAll(snippetRegex)];

  for (let i = 0; i < Math.min(titleMatches.length, 8); i++) {
    const titleMatch = titleMatches[i];
    const snippetMatch = snippetMatches[i];
    if (!titleMatch?.[1] || !titleMatch[2]) continue;

    // DuckDuckGo wraps URLs in a redirect — extract the actual URL
    let url = titleMatch[1];
    const uddgMatch = url.match(/[?&]uddg=([^&]+)/);
    if (uddgMatch?.[1]) {
      url = decodeURIComponent(uddgMatch[1]);
    }

    results.push({
      title: htmlToText(titleMatch[2]),
      url,
      snippet: snippetMatch?.[1] ? htmlToText(snippetMatch[1]) : "",
    });
  }

  if (results.length === 0) {
    return "No search results found.";
  }

  return results
    .map((r, i) => `${i + 1}. **${r.title}**\n   ${r.url}\n   ${r.snippet}`)
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
    default:
      return `Unknown tool: ${name}`;
  }
}
