import { existsSync, mkdirSync, createWriteStream } from "fs";
import { execSync } from "child_process";
import {  pipeline } from "stream/promises";
import { join } from "path";

// Configuration
const API_URL = process.env.NEXT_PUBLIC_APP_URL || "https://capable.ai"; // Fallback to SaaS
const WORKSPACE_DIR = process.env.WORKSPACE_DIR || "/workspace";
const PROJECT_ID = process.env.PROJECT_ID;
const PROJECT_TOKEN = process.env.PROJECT_TOKEN;
const PACK_VERSION = process.env.PACK_VERSION ? parseInt(process.env.PACK_VERSION) : undefined;

async function downloadFile(url, dest) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.statusText}`);
  await pipeline(res.body, createWriteStream(dest));
}

async function main() {
  console.log(">>> [Boot] Starting Capable Pack Bootstrap...");
  
  if (!PROJECT_ID || !PROJECT_TOKEN) {
    console.log(">>> [Boot] No PROJECT_ID or PROJECT_TOKEN provided. Skipping pack download.");
    return;
  }

  // Ensure workspace exists
  if (!existsSync(WORKSPACE_DIR)) {
    mkdirSync(WORKSPACE_DIR, { recursive: true });
  }

  // Check if pack is already present
  // For now, we always try to update if credentials are present, 
  // relying on the API to give us the "latest" or specific version.
  // In a real optimized scenario, we might check a version file.
  
  try {
    console.log(`>>> [Boot] Requesting pack download URL for project ${PROJECT_ID}...`);
    const resp = await fetch(`${API_URL}/api/packs/${PROJECT_ID}/download-url`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ 
        projectToken: PROJECT_TOKEN,
        version: PACK_VERSION
      })
    });

    if (!resp.ok) {
      throw new Error(`API Error: ${resp.status} ${await resp.text()}`);
    }

    const { url } = await resp.json();
    console.log(">>> [Boot] Downloading pack...");
    
    const zipPath = join("/tmp", "pack.zip");
    await downloadFile(url, zipPath);
    
    console.log(">>> [Boot] Unzipping pack...");
    // We assume 'unzip' is installed in the container
    try {
      execSync(`unzip -o "${zipPath}" -d "${WORKSPACE_DIR}"`, { stdio: "inherit" });
    } catch (e) {
      // Fallback if system unzip fails or isn't there? 
      // We should ensure it's in Dockerfile.
      console.error(">>> [Boot] Failed to unzip:", e.message);
      process.exit(1);
    }
    
    console.log(">>> [Boot] Pack installed successfully.");
    
  } catch (error) {
    console.error(">>> [Boot] Error installing pack:", error);
    // We don't exit(1) because maybe the dashboard can still run 
    // even if the pack failed to download (e.g. valid pack already there).
    // But for a fresh install this is bad.
  }
}

main();
