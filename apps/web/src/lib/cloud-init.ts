export interface CloudInitParams {
  appUrl: string;
  projectId: string;
  projectToken: string;
  packVersion: number;
  subdomain?: string; // e.g. "jarvis" → jarvis.capable.ai
}

export function generateCloudInitScript(params: CloudInitParams): string {
  const { appUrl, projectId, projectToken, packVersion, subdomain } = params;

  // Determine the total step count and dashboard URL format based on subdomain
  const hasSub = !!subdomain;
  const totalSteps = hasSub ? 11 : 9;

  // Build Caddy install + config steps (only when subdomain is present)
  const caddySteps = hasSub
    ? `
echo ">>> [10/${totalSteps}] Installing Caddy..."
apt-get install -y debian-keyring debian-archive-keyring apt-transport-https
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | tee /etc/apt/sources.list.d/caddy-stable.list
apt-get update
apt-get install -y caddy

echo ">>> [11/${totalSteps}] Configuring Caddy for ${subdomain}.capable.ai..."
cat > /etc/caddy/Caddyfile << 'CADDY'
${subdomain}.capable.ai {
    reverse_proxy localhost:3100
}
CADDY

systemctl restart caddy
systemctl enable caddy

# Open HTTP (80) + HTTPS (443) for Caddy / Let's Encrypt, close direct 3100
ufw allow 80/tcp
ufw allow 443/tcp
ufw delete allow 3100/tcp
`
    : "";

  // Dashboard URL shown in final output
  const dashboardUrl = hasSub
    ? `https://${subdomain}.capable.ai`
    : "http://$DROPLET_IP:3100";

  return `#!/bin/bash
# =========================================
# Capable.ai — Cloud-Init Script
# Paste this into your DigitalOcean droplet User Data field
# =========================================

set -euo pipefail

export DEBIAN_FRONTEND=noninteractive

echo ">>> [1/${totalSteps}] Installing Node.js 20..."
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs unzip python3 curl git ufw

# Install pnpm
npm install -g pnpm@9.15.0

echo ">>> [2/${totalSteps}] Creating directories..."
mkdir -p /root/.openclaw/workspace
mkdir -p /data/activity

echo ">>> [3/${totalSteps}] Downloading Capable Pack v${packVersion}..."
PACK_URL=$(curl -sf -X POST ${appUrl}/api/packs/${projectId}/download-url \\
  -H "Content-Type: application/json" \\
  -d '{"version":${packVersion},"projectToken":"${projectToken}"}' | python3 -c "import sys,json; print(json.load(sys.stdin)['url'])")

curl -fsSL "$PACK_URL" -o /tmp/pack.zip
cd /root/.openclaw/workspace && unzip -o /tmp/pack.zip

# Copy activity files to data dir
if [ -d "/root/.openclaw/workspace/activity" ]; then
  cp -r /root/.openclaw/workspace/activity/* /data/activity/ 2>/dev/null || true
fi

echo ">>> [4/${totalSteps}] Installing OpenClaw..."
npm install -g openclaw

# Write base OpenClaw config — merges configPatch.json from pack
# Provider and apiKey left empty — the dashboard setup wizard fills those in
if [ -f "/root/.openclaw/workspace/configPatch.json" ]; then
  CONFIG_PATCH=$(cat /root/.openclaw/workspace/configPatch.json)
else
  CONFIG_PATCH='{}'
fi

# Build the base openclaw.json config
python3 -c "
import json, sys

# Load configPatch from pack (memory boost settings)
try:
    patch = json.loads('''$CONFIG_PATCH''')
except:
    patch = {}

config = {
    'workspace': '/root/.openclaw/workspace',
    'provider': '',
    'apiKey': '',
    'model': '',
    'compaction': patch.get('compaction', {
        'memoryFlush': { 'enabled': True }
    }),
    'memorySearch': patch.get('memorySearch', {
        'experimental': { 'sessionMemory': True },
        'sources': ['memory', 'sessions']
    }),
    'skills': {
        'enabled': [
            'web-search',
            'file-reader',
            'memory',
            'calendar',
            'notes'
        ],
        'disabled': [
            'exec',
            'shell',
            'file-writer',
            'browser-automation'
        ]
    },
    'security': {
        'execPolicy': 'disabled',
        'sandboxMode': 'strict',
        'allowExternalUrls': False,
        'dmPairingRequired': True
    },
    'channels': {}
}

with open('/root/.openclaw/openclaw.json', 'w') as f:
    json.dump(config, f, indent=2)
"
chmod 600 /root/.openclaw/openclaw.json

# Mark as needing setup — dashboard wizard will complete configuration
touch /root/.openclaw/.setup-pending

echo ">>> [5/${totalSteps}] Applying security hardening..."
# Firewall: only allow SSH (22) and Dashboard (3100)
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp
ufw allow 3100/tcp
ufw --force enable

echo ">>> [6/${totalSteps}] Cloning and building dashboard..."
cd /opt
git clone --depth 1 https://github.com/iGOTHAM/capable-ai-2.0.git capable-ai
cd /opt/capable-ai

# Install deps and build just the dashboard
pnpm install --frozen-lockfile
STANDALONE=1 pnpm build:dashboard

echo ">>> [7/${totalSteps}] Generating dashboard credentials..."
DASH_PASSWORD=$(openssl rand -base64 16)
DROPLET_IP=$(curl -s ifconfig.me)

cat > /root/dashboard-credentials.txt << CREDENTIALS
Capable Dashboard Credentials
==============================
URL:      ${dashboardUrl}
Password: $DASH_PASSWORD
Created:  $(date -u +"%Y-%m-%d %H:%M:%S UTC")
CREDENTIALS
chmod 600 /root/dashboard-credentials.txt

echo ">>> [8/${totalSteps}] Starting dashboard..."
# Create systemd service for the dashboard
cat > /etc/systemd/system/capable-dashboard.service << SYSTEMD
[Unit]
Description=Capable.ai Dashboard
After=network.target

[Service]
Type=simple
WorkingDirectory=/opt/capable-ai/apps/dashboard
ExecStart=/usr/bin/node .next/standalone/apps/dashboard/server.js
Restart=always
RestartSec=5
Environment=NODE_ENV=production
Environment=PORT=3100
Environment=HOSTNAME=0.0.0.0
Environment=AUTH_PASSWORD=$DASH_PASSWORD
Environment=DATA_DIR=/data/activity
Environment=OPENCLAW_CONFIG=/root/.openclaw/openclaw.json
Environment=OPENCLAW_DIR=/root/.openclaw

[Install]
WantedBy=multi-user.target
SYSTEMD

systemctl daemon-reload
systemctl enable capable-dashboard
systemctl start capable-dashboard

echo ">>> [9/${totalSteps}] Setting up heartbeat..."
# Save IP for cron reuse
echo "$DROPLET_IP" > /etc/capable-droplet-ip

# Send initial heartbeat
curl -sf -X POST ${appUrl}/api/deployments/heartbeat \\
  -H "Content-Type: application/json" \\
  -d '{"projectToken":"${projectToken}","dropletIp":"'"$DROPLET_IP"'","packVersion":${packVersion},"status":"active"}' || true

# Set up recurring heartbeat every 5 minutes
cat > /etc/cron.d/capable-heartbeat << 'CRON'
*/5 * * * * root DROPLET_IP=$(/bin/cat /etc/capable-droplet-ip); /usr/bin/curl -sf -X POST ${appUrl}/api/deployments/heartbeat -H "Content-Type: application/json" -d "{\\"projectToken\\":\\"${projectToken}\\",\\"dropletIp\\":\\"$DROPLET_IP\\",\\"packVersion\\":${packVersion},\\"status\\":\\"active\\"}" > /dev/null 2>&1
CRON
chmod 644 /etc/cron.d/capable-heartbeat
${caddySteps}
echo ""
echo "========================================="
echo "  Capable.ai deployment complete!"
echo "========================================="
echo "  Dashboard: ${dashboardUrl}"
echo "  Password:  $DASH_PASSWORD"
echo ""
echo "  Next step: Visit your dashboard to"
echo "  complete the setup wizard."
echo ""
echo "  Credentials saved to:"
echo "  /root/dashboard-credentials.txt"
echo "========================================="`;
}
