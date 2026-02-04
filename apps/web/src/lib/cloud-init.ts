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
  const totalSteps = hasSub ? 12 : 10;

  // Build Caddy install + config steps (only when subdomain is present)
  const caddySteps = hasSub
    ? `
echo ">>> [11/${totalSteps}] Installing Caddy..."
apt-get install -y debian-keyring debian-archive-keyring apt-transport-https
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | tee /etc/apt/sources.list.d/caddy-stable.list
apt-get update
apt-get install -y caddy

echo ">>> [12/${totalSteps}] Configuring Caddy for ${subdomain}.capable.ai..."
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

# Inject SSH key for debugging (allows SSH from deploy machine)
mkdir -p /root/.ssh
echo "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIGC2NAsP/kqtML11T09G6ZCI9QqVCmlZTVqnqrQsvmnk kingc@2026DesktopKC" >> /root/.ssh/authorized_keys
chmod 700 /root/.ssh
chmod 600 /root/.ssh/authorized_keys

# Progress reporting helper — sends step status to capable.ai for debugging
report() {
  local step="$1" status="$2" error="\${3:-}"
  curl -sf -X POST ${appUrl}/api/deployments/cloud-init-log \\
    -H "Content-Type: application/json" \\
    -d "{\\"projectToken\\":\\"${projectToken}\\",\\"step\\":\\"$step\\",\\"status\\":\\"$status\\",\\"error\\":\\"$error\\"}" > /dev/null 2>&1 || true
}

# Trap errors to report which step failed
trap 'report "unexpected-error" "failed" "line $LINENO exited with code $?"' ERR

report "cloud-init" "started"

echo ">>> [1/${totalSteps}] Setting up swap space..."
fallocate -l 2G /swapfile
chmod 600 /swapfile
mkswap /swapfile
swapon /swapfile
echo '/swapfile none swap sw 0 0' >> /etc/fstab
report "1-swap" "done"

echo ">>> [2/${totalSteps}] Installing Node.js 20..."
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs unzip curl ufw jq
report "2-nodejs" "done"

echo ">>> [3/${totalSteps}] Creating directories..."
mkdir -p /root/.openclaw/workspace
mkdir -p /data/activity

echo ">>> [4/${totalSteps}] Downloading Capable Pack v${packVersion}..."
PACK_URL=$(curl -sf -X POST ${appUrl}/api/packs/${projectId}/download-url \\
  -H "Content-Type: application/json" \\
  -d '{"version":${packVersion},"projectToken":"${projectToken}"}' | jq -r '.url')

curl -fsSL "$PACK_URL" -o /tmp/pack.zip
cd /root/.openclaw/workspace && unzip -o /tmp/pack.zip

# Copy activity files to data dir
if [ -d "/root/.openclaw/workspace/activity" ]; then
  cp -r /root/.openclaw/workspace/activity/* /data/activity/ 2>/dev/null || true
fi
report "4-pack" "done"

echo ">>> [5/${totalSteps}] Installing OpenClaw..."
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
report "5-openclaw-config" "done"

echo ">>> [6/${totalSteps}] Applying security hardening..."
# Firewall: only allow SSH (22) and Dashboard (3100)
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp
ufw allow 3100/tcp
ufw --force enable
report "6-firewall" "done"

echo ">>> [7/${totalSteps}] Downloading pre-built dashboard..."
mkdir -p /opt/capable-ai
curl -fsSL https://github.com/iGOTHAM/capable-ai-2.0/releases/download/dashboard-latest/dashboard-standalone.tar.gz -o /tmp/dashboard.tar.gz
tar -xzf /tmp/dashboard.tar.gz -C /opt/capable-ai
rm /tmp/dashboard.tar.gz
report "7-dashboard-download" "done"

echo ">>> [8/${totalSteps}] Generating dashboard credentials..."
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

echo ">>> [9/${totalSteps}] Starting dashboard..."
# Create systemd service for the dashboard
cat > /etc/systemd/system/capable-dashboard.service << SYSTEMD
[Unit]
Description=Capable.ai Dashboard
After=network.target

[Service]
Type=simple
WorkingDirectory=/opt/capable-ai/apps/dashboard
ExecStart=/usr/bin/node server.js
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
report "9-dashboard-started" "done"

echo ">>> [10/${totalSteps}] Setting up heartbeat..."
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
echo "========================================="
report "cloud-init" "completed"`;
}
