export interface CloudInitParams {
  appUrl: string;
  projectId: string;
  projectToken: string;
  packVersion: number;
}

export function generateCloudInitScript(params: CloudInitParams): string {
  const { appUrl, projectId, projectToken, packVersion } = params;

  return `#!/bin/bash
# =========================================
# Capable.ai — Cloud-Init Script
# Paste this into your DigitalOcean droplet User Data field
# =========================================

set -euo pipefail

export DEBIAN_FRONTEND=noninteractive

echo ">>> [1/7] Installing Node.js 20..."
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs unzip python3 curl git

# Install pnpm
npm install -g pnpm@9.15.0

echo ">>> [2/7] Creating directories..."
mkdir -p /root/.openclaw/workspace
mkdir -p /data/activity

echo ">>> [3/7] Downloading Capable Pack v${packVersion}..."
PACK_URL=$(curl -sf -X POST ${appUrl}/api/packs/${projectId}/download-url \\
  -H "Content-Type: application/json" \\
  -d '{"version":${packVersion},"projectToken":"${projectToken}"}' | python3 -c "import sys,json; print(json.load(sys.stdin)['url'])")

curl -fsSL "$PACK_URL" -o /tmp/pack.zip
cd /root/.openclaw/workspace && unzip -o /tmp/pack.zip

# Copy activity files to data dir
if [ -d "/root/.openclaw/workspace/activity" ]; then
  cp -r /root/.openclaw/workspace/activity/* /data/activity/ 2>/dev/null || true
fi

echo ">>> [4/7] Cloning and building dashboard..."
cd /opt
git clone --depth 1 https://github.com/iGOTHAM/capable-ai-2.0.git capable-ai
cd /opt/capable-ai

# Install deps and build just the dashboard
pnpm install --frozen-lockfile
STANDALONE=1 pnpm build:dashboard

echo ">>> [5/7] Generating dashboard credentials..."
DASH_PASSWORD=$(openssl rand -base64 16)
DROPLET_IP=$(curl -s ifconfig.me)

cat > /root/dashboard-credentials.txt << CREDENTIALS
Capable Dashboard Credentials
==============================
URL:      http://$DROPLET_IP:3100
Password: $DASH_PASSWORD
Created:  $(date -u +"%Y-%m-%d %H:%M:%S UTC")
CREDENTIALS
chmod 600 /root/dashboard-credentials.txt

echo ">>> [6/7] Starting dashboard..."
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

[Install]
WantedBy=multi-user.target
SYSTEMD

systemctl daemon-reload
systemctl enable capable-dashboard
systemctl start capable-dashboard

echo ">>> [7/7] Setting up heartbeat..."
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

echo ""
echo "========================================="
echo "  Capable.ai deployment complete!"
echo "========================================="
echo "  Dashboard: http://$DROPLET_IP:3100"
echo "  Password:  $DASH_PASSWORD"
echo ""
echo "  Credentials saved to:"
echo "  /root/dashboard-credentials.txt"
echo "========================================="`;
}
