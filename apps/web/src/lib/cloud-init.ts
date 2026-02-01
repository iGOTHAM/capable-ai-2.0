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

echo ">>> [1/7] Installing Docker..."
curl -fsSL https://get.docker.com | sh

echo ">>> [2/7] Installing dependencies..."
apt-get install -y unzip python3 curl

echo ">>> [3/7] Creating directories..."
mkdir -p /root/.openclaw/workspace
mkdir -p /data/activity

echo ">>> [4/7] Downloading Capable Pack v${packVersion}..."
PACK_URL=$(curl -sf -X POST ${appUrl}/api/packs/${projectId}/download-url \\
  -H "Content-Type: application/json" \\
  -d '{"version":${packVersion},"projectToken":"${projectToken}"}' | python3 -c "import sys,json; print(json.load(sys.stdin)['url'])")

curl -fsSL "$PACK_URL" -o /tmp/pack.zip
cd /root/.openclaw/workspace && unzip -o /tmp/pack.zip

# Copy activity files to data dir
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

# Save IP for cron reuse (single-quoted heredoc can't expand subshells)
echo "$DROPLET_IP" > /etc/capable-droplet-ip

# Send initial heartbeat
curl -sf -X POST ${appUrl}/api/deployments/heartbeat \\
  -H "Content-Type: application/json" \\
  -d '{"projectToken":"${projectToken}","dropletIp":"'"$DROPLET_IP"'","packVersion":${packVersion},"status":"active"}' || true

# Set up recurring heartbeat every 5 minutes
# Note: JS template vars (appUrl, projectToken, packVersion) are baked in at generation time.
# The IP is read from a file since single-quoted heredoc prevents bash subshell expansion.
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
