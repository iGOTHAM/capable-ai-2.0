/**
 * Capable.ai — Cloud-Init Generator (CLI)
 *
 * Usage: npx tsx scripts/cloud-init-generator.ts \
 *   --app-url https://capable.ai \
 *   --project-id <id> \
 *   --project-token <token> \
 *   --pack-version 1 \
 *   --output cloud-init.sh
 */

import { writeFileSync } from "fs";

interface Params {
  appUrl: string;
  projectId: string;
  projectToken: string;
  packVersion: number;
  output: string;
}

function parseArgs(): Params {
  const args = process.argv.slice(2);
  const params: Record<string, string> = {};

  for (let i = 0; i < args.length; i += 2) {
    const key = args[i]?.replace(/^--/, "");
    const value = args[i + 1];
    if (key && value) {
      params[key] = value;
    }
  }

  if (!params["app-url"] || !params["project-id"] || !params["project-token"]) {
    console.error(
      "Usage: npx tsx scripts/cloud-init-generator.ts \\\n" +
        "  --app-url <url> \\\n" +
        "  --project-id <id> \\\n" +
        "  --project-token <token> \\\n" +
        "  --pack-version <version> \\\n" +
        "  --output <filename>",
    );
    process.exit(1);
  }

  return {
    appUrl: params["app-url"],
    projectId: params["project-id"],
    projectToken: params["project-token"],
    packVersion: parseInt(params["pack-version"] || "1", 10),
    output: params["output"] || "cloud-init.sh",
  };
}

function generateScript(p: Params): string {
  return `#!/bin/bash
# =========================================
# Capable.ai — Cloud-Init Script
# Generated for project: ${p.projectId}
# =========================================

set -euo pipefail
export DEBIAN_FRONTEND=noninteractive

echo ">>> [1/7] Installing Docker..."
curl -fsSL https://get.docker.com | sh

echo ">>> [2/7] Installing dependencies..."
apt-get install -y unzip python3 curl

echo ">>> [3/7] Creating directories..."
mkdir -p /root/.openclaw/workspace
mkdir -p /data/activity

echo ">>> [4/7] Downloading Capable Pack v${p.packVersion}..."
PACK_URL=$(curl -sf -X POST ${p.appUrl}/api/packs/${p.projectId}/download-url \\
  -H "Content-Type: application/json" \\
  -d '{"version":${p.packVersion}}' | python3 -c "import sys,json; print(json.load(sys.stdin)['url'])")

curl -fsSL "$PACK_URL" -o /tmp/pack.zip
cd /root/.openclaw/workspace && unzip -o /tmp/pack.zip

if [ -d "/root/.openclaw/workspace/activity" ]; then
  cp -r /root/.openclaw/workspace/activity/* /data/activity/ 2>/dev/null || true
fi

echo ">>> [5/7] Generating dashboard credentials..."
DASH_PASSWORD=$(openssl rand -base64 16)
cat > /root/dashboard-credentials.txt << CREDENTIALS
Capable Dashboard Credentials
==============================
URL:      http://$(curl -s ifconfig.me):3100
Password: $DASH_PASSWORD
Created:  $(date -u +"%Y-%m-%d %H:%M:%S UTC")
CREDENTIALS
chmod 600 /root/dashboard-credentials.txt

echo ">>> [6/7] Starting dashboard..."
docker run -d \\
  --name capable-dashboard \\
  --restart unless-stopped \\
  -p 3100:3100 \\
  -v /data/activity:/data/activity \\
  -v /root/.openclaw/workspace:/workspace \\
  -e AUTH_PASSWORD="$DASH_PASSWORD" \\
  -e DATA_DIR="/data/activity" \\
  -e NODE_ENV="production" \\
  capable-ai/dashboard:latest

echo ">>> [7/7] Setting up heartbeat..."
DROPLET_IP=$(curl -s ifconfig.me)

curl -sf -X POST ${p.appUrl}/api/deployments/heartbeat \\
  -H "Content-Type: application/json" \\
  -d '{"projectToken":"${p.projectToken}","dropletIp":"'"$DROPLET_IP"'","packVersion":${p.packVersion},"status":"active"}' || true

cat > /etc/cron.d/capable-heartbeat << 'CRON'
*/5 * * * * root curl -sf -X POST ${p.appUrl}/api/deployments/heartbeat -H "Content-Type: application/json" -d '{"projectToken":"${p.projectToken}","dropletIp":"'"$(curl -s ifconfig.me)"'","packVersion":${p.packVersion},"status":"active"}' > /dev/null 2>&1
CRON
chmod 644 /etc/cron.d/capable-heartbeat

echo ""
echo "========================================="
echo "  Capable.ai deployment complete!"
echo "  Dashboard: http://$DROPLET_IP:3100"
echo "  Password:  $DASH_PASSWORD"
echo "========================================="`;
}

const params = parseArgs();
const script = generateScript(params);
writeFileSync(params.output, script, { mode: 0o755 });
console.log(`Cloud-init script written to ${params.output}`);
