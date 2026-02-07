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
    # OpenClaw Web UI — strip /chat prefix before proxying
    # e.g. /chat/foo → OpenClaw receives /foo
    handle_path /chat/* {
        reverse_proxy localhost:18789
    }

    # Bare /chat → redirect to /chat/ (trailing slash required by OpenClaw)
    redir /chat /chat/ permanent

    # Dashboard — everything else
    handle {
        reverse_proxy localhost:3100
    }
}
CADDY

systemctl restart caddy
systemctl enable caddy

# Open HTTP (80) + HTTPS (443) for Caddy / Let's Encrypt
# Keep 3100 open as fallback for admin API (set-key, push-pack, etc.)
ufw allow 80/tcp
ufw allow 443/tcp
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

# Disable forced password change (DO sets this when no SSH key is on the account)
chage -d $(date +%Y-%m-%d) root

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

echo ">>> [2/${totalSteps}] Installing Node.js 22..."
curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
apt-get install -y nodejs curl ufw jq
report "2-nodejs" "done"

echo ">>> [3/${totalSteps}] Creating directories..."
mkdir -p /root/.openclaw/workspace
mkdir -p /data/activity

echo ">>> [4/${totalSteps}] Downloading Capable Pack v${packVersion}..."
PACK_URL=$(curl -sf -X POST ${appUrl}/api/packs/${projectId}/download-url \\
  -H "Content-Type: application/json" \\
  -d '{"version":${packVersion},"projectToken":"${projectToken}"}' | jq -r '.url')

# Download pack files as JSON (fast — avoids zip/archiver timeout on serverless)
curl -fsSL "\${PACK_URL}&format=json" -o /tmp/pack.json

# Extract files from JSON and write to workspace
cd /root/.openclaw/workspace
for filename in $(jq -r '.files | keys[]' /tmp/pack.json); do
  mkdir -p "$(dirname "$filename")"
  jq -r --arg f "$filename" '.files[$f]' /tmp/pack.json > "$filename"
done
rm /tmp/pack.json

# Copy activity files to data dir
if [ -d "/root/.openclaw/workspace/activity" ]; then
  cp -r /root/.openclaw/workspace/activity/* /data/activity/ 2>/dev/null || true
fi
report "4-pack" "done"

echo ">>> [5/${totalSteps}] Installing OpenClaw..."
npm install -g openclaw@latest
# Verify install & find binary
OPENCLAW_BIN=$(npm prefix -g)/bin/openclaw
echo "  OpenClaw binary: $OPENCLAW_BIN"
ls -la "$OPENCLAW_BIN" || { echo "ERROR: openclaw binary not found"; report "5-openclaw" "failed" "binary not found at $OPENCLAW_BIN"; }

# Write minimal OpenClaw config — only fields we're confident about
# Keep it minimal to avoid schema validation failures (unknown keys cause crash)
echo '{}' > /root/.openclaw/openclaw.json
chmod 600 /root/.openclaw/openclaw.json

# Run OpenClaw doctor to check what's missing (diagnostic, non-blocking)
$OPENCLAW_BIN doctor 2>&1 | head -30 || true
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
ADMIN_SECRET=$(openssl rand -hex 32)
DROPLET_IP=$(curl -4 -s ifconfig.me)

cat > /root/dashboard-credentials.txt << CREDENTIALS
Capable Dashboard Credentials
==============================
URL:      ${dashboardUrl}
Password: $DASH_PASSWORD
Admin:    $ADMIN_SECRET
Created:  $(date -u +"%Y-%m-%d %H:%M:%S UTC")
CREDENTIALS
chmod 600 /root/dashboard-credentials.txt

# Store admin secret separately for env file
echo "AUTH_PASSWORD=$DASH_PASSWORD" > /etc/capable-dashboard.env
echo "ADMIN_SECRET=$ADMIN_SECRET" >> /etc/capable-dashboard.env
chmod 600 /etc/capable-dashboard.env

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
EnvironmentFile=/etc/capable-dashboard.env
Environment=NODE_ENV=production
Environment=PORT=3100
Environment=HOSTNAME=0.0.0.0
Environment=DATA_DIR=/data/activity
Environment=OPENCLAW_CONFIG=/root/.openclaw/openclaw.json
Environment=OPENCLAW_DIR=/root/.openclaw

[Install]
WantedBy=multi-user.target
SYSTEMD

systemctl daemon-reload
systemctl enable capable-dashboard
systemctl start capable-dashboard

# Create systemd service for OpenClaw agent
cat > /etc/systemd/system/capable-openclaw.service << SYSTEMD
[Unit]
Description=OpenClaw Agent
After=network.target capable-dashboard.service

[Service]
Type=simple
ExecStart=$OPENCLAW_BIN gateway --allow-unconfigured --port 18789
Restart=always
RestartSec=5
Environment=NODE_ENV=production
Environment=HOME=/root
Environment=PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin

[Install]
WantedBy=multi-user.target
SYSTEMD

systemctl daemon-reload
systemctl enable capable-openclaw
systemctl start capable-openclaw

# Verify OpenClaw is running (give it a few seconds to start)
sleep 5
if systemctl is-active --quiet capable-openclaw; then
  echo "  OpenClaw service is running"
else
  echo "  WARNING: OpenClaw service failed to start"
  journalctl -u capable-openclaw --no-pager -n 20
  report "9-openclaw-start" "failed" "$(journalctl -u capable-openclaw --no-pager -n 5 | head -c 400)"
fi
report "9-dashboard-started" "done"

echo ">>> [10/${totalSteps}] Setting up heartbeat..."
# Save IP for cron reuse
echo "$DROPLET_IP" > /etc/capable-droplet-ip

# Send initial heartbeat (includes password + admin secret so web app can manage the dashboard)
curl -sf -X POST ${appUrl}/api/deployments/heartbeat \\
  -H "Content-Type: application/json" \\
  -d '{"projectToken":"${projectToken}","dropletIp":"'"$DROPLET_IP"'","packVersion":${packVersion},"status":"active","dashboardPassword":"'"$DASH_PASSWORD"'","adminSecret":"'"$ADMIN_SECRET"'"}' || true

# Set up recurring heartbeat every 5 minutes (no password — only sent once)
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
echo "  Chat:      ${dashboardUrl}/chat/"
echo "  Password:  $DASH_PASSWORD"
echo ""
echo "  Your AI provider will be configured"
echo "  automatically from the deploy page."
echo ""
echo "  Credentials saved to:"
echo "  /root/dashboard-credentials.txt"
echo "========================================="
report "cloud-init" "completed"`;
}
