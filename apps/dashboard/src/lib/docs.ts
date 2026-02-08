import { promises as fs } from "fs";
import path from "path";

// ─── Paths ──────────────────────────────────────────────────────────────────

const OPENCLAW_DIR = process.env.OPENCLAW_DIR || "/root/.openclaw";
const WORKSPACE = path.join(OPENCLAW_DIR, "workspace");

// ─── Types ──────────────────────────────────────────────────────────────────

export type DocCategory = "system" | "knowledge" | "memory" | "deal" | "upload";

export interface DocEntry {
  name: string;
  path: string; // relative to workspace
  type: "file" | "folder";
  category: DocCategory;
  size?: number;
  modified?: string;
  editable: boolean;
  children?: DocEntry[];
}

// ─── Category Classification ────────────────────────────────────────────────

const SYSTEM_FILES = new Set([
  "SOUL.md",
  "AGENTS.md",
  "USER.md",
  "MEMORY.md",
]);

function classifyPath(relativePath: string): {
  category: DocCategory;
  editable: boolean;
} {
  const parts = relativePath.split("/");
  const topLevel = parts[0] ?? "";
  const fileName = parts[parts.length - 1] ?? "";

  // Root-level system files
  if (parts.length === 1 && SYSTEM_FILES.has(fileName)) {
    return { category: "system", editable: false };
  }

  // Folder-based classification
  if (topLevel === "knowledge") {
    return { category: "knowledge", editable: true };
  }
  if (topLevel === "memory") {
    return { category: "memory", editable: true };
  }
  if (topLevel === "deals") {
    return { category: "deal", editable: true };
  }
  if (topLevel === "uploads") {
    return { category: "upload", editable: false }; // binary files
  }

  // Default: editable
  return { category: "knowledge", editable: true };
}

// ─── Path Security ──────────────────────────────────────────────────────────

/** Resolve a relative path within the workspace and validate it doesn't escape */
function resolveSecure(relativePath: string): string | null {
  const resolved = path.resolve(WORKSPACE, relativePath);
  if (!resolved.startsWith(WORKSPACE)) {
    return null; // path traversal attempt
  }
  return resolved;
}

// ─── Scan Workspace ─────────────────────────────────────────────────────────

/** Skip these directories/files during scanning */
const SKIP = new Set([
  "node_modules",
  ".git",
  ".cache",
  "activity", // NDJSON events — separate system
  "tasks.json", // managed by tasks lib
  "configPatch.json",
]);

async function scanDir(
  dirPath: string,
  relativeTo: string,
  depth = 0,
): Promise<DocEntry[]> {
  if (depth > 4) return []; // prevent deep recursion

  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    const results: DocEntry[] = [];

    for (const entry of entries) {
      if (SKIP.has(entry.name)) continue;
      if (entry.name.startsWith(".")) continue; // skip dotfiles

      const relativePath = relativeTo
        ? `${relativeTo}/${entry.name}`
        : entry.name;

      if (entry.isDirectory()) {
        const children = await scanDir(
          path.join(dirPath, entry.name),
          relativePath,
          depth + 1,
        );
        const { category } = classifyPath(relativePath);
        results.push({
          name: entry.name,
          path: relativePath,
          type: "folder",
          category,
          editable: true,
          children,
        });
      } else if (entry.isFile()) {
        try {
          const stat = await fs.stat(path.join(dirPath, entry.name));
          const { category, editable } = classifyPath(relativePath);
          results.push({
            name: entry.name,
            path: relativePath,
            type: "file",
            category,
            size: stat.size,
            modified: stat.mtime.toISOString(),
            editable,
          });
        } catch {
          // Skip files we can't stat
        }
      }
    }

    // Sort: folders first, then files, alphabetically
    results.sort((a, b) => {
      if (a.type !== b.type) return a.type === "folder" ? -1 : 1;
      return a.name.localeCompare(b.name);
    });

    return results;
  } catch {
    return [];
  }
}

// ─── Public API ─────────────────────────────────────────────────────────────

/** List all documents in workspace as a folder tree */
export async function listDocs(): Promise<DocEntry[]> {
  return scanDir(WORKSPACE, "");
}

/** Read a document's content */
export async function readDoc(
  relativePath: string,
): Promise<{ content: string; size: number; modified: string } | null> {
  const fullPath = resolveSecure(relativePath);
  if (!fullPath) return null;

  try {
    const stat = await fs.stat(fullPath);
    if (!stat.isFile()) return null;

    const content = await fs.readFile(fullPath, "utf-8");
    return {
      content,
      size: stat.size,
      modified: stat.mtime.toISOString(),
    };
  } catch {
    return null;
  }
}

/** Write/update a document */
export async function writeDoc(
  relativePath: string,
  content: string,
): Promise<boolean> {
  const fullPath = resolveSecure(relativePath);
  if (!fullPath) return false;

  // Check editability
  const { editable } = classifyPath(relativePath);
  if (!editable) return false;

  try {
    await fs.mkdir(path.dirname(fullPath), { recursive: true });
    await fs.writeFile(fullPath, content, "utf-8");
    return true;
  } catch {
    return false;
  }
}

/** Create a folder in the workspace */
export async function createFolder(relativePath: string): Promise<boolean> {
  const fullPath = resolveSecure(relativePath);
  if (!fullPath) return false;

  try {
    await fs.mkdir(fullPath, { recursive: true });
    return true;
  } catch {
    return false;
  }
}

/** Delete a document (restricted to editable paths only) */
export async function deleteDoc(relativePath: string): Promise<boolean> {
  const fullPath = resolveSecure(relativePath);
  if (!fullPath) return false;

  const { editable } = classifyPath(relativePath);
  if (!editable) return false;

  try {
    const stat = await fs.stat(fullPath);
    if (stat.isDirectory()) {
      // Only delete empty directories
      const entries = await fs.readdir(fullPath);
      if (entries.length > 0) return false;
      await fs.rmdir(fullPath);
    } else {
      await fs.unlink(fullPath);
    }
    return true;
  } catch {
    return false;
  }
}
