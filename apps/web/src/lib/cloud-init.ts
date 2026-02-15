/** Known-good OpenClaw version — update deliberately after testing each release */
export const OPENCLAW_VERSION = "2026.2.6-3";

// GitHub repo info for dashboard release download
const GH_OWNER = "iGOTHAM";
const GH_REPO = "capable-ai-2.0";
const GH_RELEASE_TAG = "dashboard-latest";
const GH_ASSET_NAME = "dashboard-standalone.tar.gz";

/**
 * Get a temporary signed download URL for the dashboard standalone tarball.
 *
 * The repo is private, so the public release download URL doesn't work for
 * unauthenticated requests (like from a freshly-created DO droplet).
 * Instead, we call the GitHub API with a server-side token to get a 302
 * redirect to a time-limited Azure Blob Storage URL (~1 hour expiry).
 *
 * This signed URL is embedded in the cloud-init script at deploy time.
 */
export async function getDashboardDownloadUrl(): Promise<string> {
  const token = process.env.GITHUB_RELEASE_TOKEN;
  if (!token) {
    throw new Error(
      "GITHUB_RELEASE_TOKEN is not set — required to download dashboard release from private repo",
    );
  }

  // Step 1: Get the release to find the asset ID
  const releaseRes = await fetch(
    `https://api.github.com/repos/${GH_OWNER}/${GH_REPO}/releases/tags/${GH_RELEASE_TAG}`,
    {
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${token}`,
        "User-Agent": "capable-ai-deploy",
      },
    },
  );

  if (!releaseRes.ok) {
    throw new Error(
      `Failed to fetch GitHub release (${releaseRes.status}): ${await releaseRes.text()}`,
    );
  }

  const release = (await releaseRes.json()) as {
    assets: Array<{ id: number; name: string }>;
  };
  const asset = release.assets.find((a) => a.name === GH_ASSET_NAME);
  if (!asset) {
    throw new Error(
      `Dashboard asset "${GH_ASSET_NAME}" not found in release "${GH_RELEASE_TAG}"`,
    );
  }

  // Step 2: Request the asset with Accept: application/octet-stream to get a 302 redirect
  const assetRes = await fetch(
    `https://api.github.com/repos/${GH_OWNER}/${GH_REPO}/releases/assets/${asset.id}`,
    {
      headers: {
        Accept: "application/octet-stream",
        Authorization: `Bearer ${token}`,
        "User-Agent": "capable-ai-deploy",
      },
      redirect: "manual",
    },
  );

  const signedUrl = assetRes.headers.get("location");
  if (!signedUrl) {
    throw new Error(
      `GitHub API did not return a redirect for asset download (status ${assetRes.status})`,
    );
  }

  return signedUrl;
}

export interface CloudInitParams {
  appUrl: string;
  projectId: string;
  projectToken: string;
  packVersion: number;
  subdomain?: string; // e.g. "jarvis" → jarvis.capable.ai
  openclawVersion?: string; // defaults to OPENCLAW_VERSION
  dashboardDownloadUrl?: string; // Signed URL for dashboard-standalone.tar.gz
}

/**
 * Generate a cloud-init bash script that deploys the full Capable.ai stack.
 *
 * Architecture:
 *   - Dashboard: bare-metal systemd service (NOT Docker — see commit a5e0ef7)
 *   - OpenClaw:  Docker container
 *   - Caddy:     Docker container (only when subdomain is configured)
 *
 * Docker was removed from the dashboard because it added caching layers
 * and made deploys take 5+ minutes. The dashboard is a standalone Next.js
 * app that doesn't need Docker.
 */
export function generateCloudInitScript(params: CloudInitParams): string {
  const { appUrl, projectId, projectToken, packVersion, subdomain } = params;
  const openclawVersion = params.openclawVersion ?? OPENCLAW_VERSION;
  const hasSub = !!subdomain;

  const dashboardTarballUrl = params.dashboardDownloadUrl
    ?? `https://github.com/${GH_OWNER}/${GH_REPO}/releases/download/${GH_RELEASE_TAG}/${GH_ASSET_NAME}`;

  const dashboardUrl = hasSub
    ? "https://" + subdomain + ".capable.ai"
    : "http://$DROPLET_IP:3100";

  const totalSteps = hasSub ? 8 : 7;

  const L: string[] = [];
  const add = (s: string) => L.push(s);

  add("#!/bin/bash");
  add("# =========================================");
  add("# Capable.ai — Cloud-Init Script");
  add("# Generated for project: " + projectId);
  add("# Dashboard: bare-metal systemd");
  add("# OpenClaw + Caddy: Docker Compose");
  add("# =========================================");
  add("");
  add("set -euo pipefail");
  add("export DEBIAN_FRONTEND=noninteractive");
  add("");
  add("# Disable forced password change (DO sets this when no SSH key)");
  add("chage -d $(date +%Y-%m-%d) root");
  add("mkdir -p /root/.ssh");
  add("chmod 700 /root/.ssh");
  add("");
  add("# Progress reporting helper");
  add("report() {");
  add('  local step="$1" status="$2" error="${3:-}"');
  add("  curl -sf -X POST " + appUrl + "/api/deployments/cloud-init-log \\");
  add('    -H "Content-Type: application/json" \\');
  add('    -d "{\\"projectToken\\":\\"' + projectToken + '\\",\\"step\\":\\"$step\\",\\"status\\":\\"$status\\",\\"error\\":\\"$error\\"}" > /dev/null 2>&1 || true');
  add("}");
  add("");
  add('trap \'report "unexpected-error" "failed" "line $LINENO exited with code $?"\' ERR');
  add('report "cloud-init" "started"');
  add("");

  // Step 1: Swap
  add('echo ">>> [1/' + totalSteps + '] Setting up swap space..."');
  add("fallocate -l 2G /swapfile");
  add("chmod 600 /swapfile");
  add("mkswap /swapfile");
  add("swapon /swapfile");
  add("echo '/swapfile none swap sw 0 0' >> /etc/fstab");
  add('report "1-swap" "done"');
  add("");

  // Step 2: Install Docker (for OpenClaw + Caddy only) + Node.js (for dashboard)
  add('echo ">>> [2/' + totalSteps + '] Installing Docker and Node.js..."');
  add("curl -fsSL https://get.docker.com | sh");
  add("# Install Node.js 22 for bare-metal dashboard");
  add("curl -fsSL https://deb.nodesource.com/setup_22.x | bash -");
  add("apt-get install -y nodejs build-essential");
  add('report "2-docker-node" "done"');
  add("");

  // Step 3: Setup directories + download dashboard tarball
  add('echo ">>> [3/' + totalSteps + '] Downloading pre-built dashboard..."');
  add("mkdir -p /opt/capable/caddy/certs");
  add("mkdir -p /opt/capable/openclaw");
  add("mkdir -p /opt/capable/dashboard");
  add("mkdir -p /opt/capable/openclaw-home");
  add("mkdir -p /opt/capable/data/activity");
  add("touch /opt/capable/.subscription-status.json");
  add('curl -fsSL "' + dashboardTarballUrl + '" -o /tmp/dashboard.tar.gz');
  add("tar -xzf /tmp/dashboard.tar.gz -C /opt/capable/dashboard");
  add("rm /tmp/dashboard.tar.gz");
  add("# Install native modules for terminal WebSocket server");
  add("cd /opt/capable/dashboard && npm install --no-save node-pty ws");
  add('report "3-dashboard-download" "done"');
  add("");

  // Step 4: Generate credentials
  add('echo ">>> [4/' + totalSteps + '] Generating credentials..."');
  add("DASH_PASSWORD=$(openssl rand -base64 16)");
  add("ADMIN_SECRET=$(openssl rand -hex 32)");
  add("GATEWAY_TOKEN=$(openssl rand -hex 32)");
  add("DROPLET_IP=$(curl -4 -sf ifconfig.me)");
  add("");
  add("cat > /opt/capable/.env << ENV");
  add("PROJECT_ID=" + projectId);
  add("PROJECT_TOKEN=" + projectToken);
  add("PACK_VERSION=" + packVersion);
  add("AUTH_PASSWORD=$DASH_PASSWORD");
  add("ADMIN_SECRET=$ADMIN_SECRET");
  add("GATEWAY_TOKEN=$GATEWAY_TOKEN");
  add("SUBDOMAIN=" + (subdomain || ""));
  add("OPENCLAW_VERSION=" + openclawVersion);
  add("NEXT_PUBLIC_APP_URL=" + appUrl);
  add("ENV");
  add("");
  add("cat > /root/dashboard-credentials.txt << CREDENTIALS");
  add("Capable Dashboard Credentials");
  add("==============================");
  add("URL:      " + dashboardUrl);
  add("Password: $DASH_PASSWORD");
  add("Admin:    $ADMIN_SECRET");
  add("Gateway:  $GATEWAY_TOKEN");
  add('Created:  $(date -u +"%Y-%m-%d %H:%M:%S UTC")');
  add("CREDENTIALS");
  add("chmod 600 /root/dashboard-credentials.txt");
  add('report "4-credentials" "done"');
  add("");

  // Early heartbeat — register the IP and credentials before the slow Docker builds
  add("# Send early heartbeat so the deploy page shows progress");
  add("curl -sf -X POST " + appUrl + "/api/deployments/heartbeat \\");
  add('  -H "Content-Type: application/json" \\');
  add("  -d '{\"projectToken\":\"" + projectToken + "\",\"dropletIp\":\"'\"$DROPLET_IP\"'\",\"packVersion\":" + packVersion + ",\"status\":\"provisioning\",\"dashboardPassword\":\"'\"$DASH_PASSWORD\"'\",\"adminSecret\":\"'\"$ADMIN_SECRET\"'\",\"gatewayToken\":\"'\"$GATEWAY_TOKEN\"'\"}' || true");
  add("");

  // Step 5: Write Docker Compose (OpenClaw + Caddy only) + systemd service
  add('echo ">>> [5/' + totalSteps + '] Writing Docker Compose and systemd configuration..."');
  add("");

  // docker-compose.yml — OpenClaw + Caddy only (dashboard is bare-metal)
  add("cat > /opt/capable/docker-compose.yml << 'COMPOSE'");
  add("# Dashboard runs bare-metal via systemd (not Docker).");
  add("# This compose file runs OpenClaw + Caddy only.");
  add("services:");
  add("  openclaw:");
  add("    build:");
  add("      context: ./openclaw");
  add("      args:");
  add("        OPENCLAW_VERSION: ${OPENCLAW_VERSION:-2026.2.6-3}");
  add("    container_name: capable-openclaw");
  add("    restart: unless-stopped");
  add("    ports:");
  add('      - "127.0.0.1:18789:18789"');
  add("    volumes:");
  add("      - /opt/capable/openclaw-home:/root/.openclaw");
  add("      - /opt/capable/data/activity:/data/activity");
  add("    environment:");
  add("      - PROJECT_ID=${PROJECT_ID}");
  add("      - PROJECT_TOKEN=${PROJECT_TOKEN}");
  add("      - PACK_VERSION=${PACK_VERSION:-1}");
  add("      - NEXT_PUBLIC_APP_URL=${NEXT_PUBLIC_APP_URL:-https://capable.ai}");
  add("      - GATEWAY_TOKEN=${GATEWAY_TOKEN}");
  add("      - OPENCLAW_GATEWAY_PORT=18789");

  if (hasSub) {
    add("");
    add("  caddy:");
    add("    image: caddy:2-alpine");
    add("    container_name: capable-caddy");
    add("    restart: unless-stopped");
    add("    ports:");
    add('      - "80:80"');
    add('      - "443:443"');
    add("    extra_hosts:");
    add('      - "host.docker.internal:host-gateway"');
    add("    volumes:");
    add("      - ./caddy/Caddyfile:/etc/caddy/Caddyfile:ro");
    add("      - caddy-data:/data");
    add("      - caddy-config:/config");
    add("      - ./caddy/certs:/etc/caddy/certs:ro");
    add("    environment:");
    add("      - CAPABLE_SUBDOMAIN=${SUBDOMAIN:-localhost}");
    add("    depends_on:");
    add("      - openclaw");
  }

  add("");
  add("volumes:");
  if (hasSub) {
    add("  caddy-data:");
    add("  caddy-config:");
  } else {
    add("  {}");
  }
  add("COMPOSE");
  add("");

  // OpenClaw Dockerfile
  add("cat > /opt/capable/openclaw/Dockerfile << 'OCDOCKER'");
  add("FROM node:22-bookworm-slim");
  add("RUN apt-get update && apt-get install -y --no-install-recommends \\");
  add("    ca-certificates chromium curl git jq openssl && rm -rf /var/lib/apt/lists/*");
  add("ENV CHROME_PATH=/usr/bin/chromium");
  add("ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium");
  add("ENV PUPPETEER_CHROMIUM_REVISION=skip");
  add("ARG OPENCLAW_VERSION=2026.2.6-3");
  add('RUN git config --global url."https://github.com/".insteadOf git@github.com: \\');
  add('    && git config --global url."https://github.com/".insteadOf ssh://git@github.com/ \\');
  add("    && npm install -g openclaw@${OPENCLAW_VERSION}");
  add("RUN mkdir -p /root/.openclaw/workspace /data/activity");
  add("COPY entrypoint.sh /entrypoint.sh");
  add("RUN chmod +x /entrypoint.sh");
  add("ENV OPENCLAW_GATEWAY_PORT=18789");
  add("EXPOSE 18789");
  add('ENTRYPOINT ["/entrypoint.sh"]');
  add("OCDOCKER");
  add("");

  // OpenClaw entrypoint
  add("cat > /opt/capable/openclaw/entrypoint.sh << 'OCENTRYPOINT'");
  add("#!/bin/bash");
  add("set -e");
  add("OPENCLAW_BIN=$(npm prefix -g)/bin/openclaw");
  add('WORKSPACE_DIR="${WORKSPACE_DIR:-/root/.openclaw/workspace}"');
  add('CONFIG_FILE="/root/.openclaw/openclaw.json"');
  add("");
  add('if [ -n "$PROJECT_ID" ] && [ -n "$PROJECT_TOKEN" ]; then');
  add('  APP_URL="${NEXT_PUBLIC_APP_URL:-https://capable.ai}"');
  add('  PACK_URL=$(curl -sf -X POST "${APP_URL}/api/packs/${PROJECT_ID}/download-url" \\');
  add('    -H "Content-Type: application/json" \\');
  add('    -d "{\\"version\\":${PACK_VERSION:-1},\\"projectToken\\":\\"${PROJECT_TOKEN}\\"}" | jq -r \'.url\')');
  add('  if [ -n "$PACK_URL" ] && [ "$PACK_URL" != "null" ]; then');
  add('    curl -fsSL "${PACK_URL}&format=json" -o /tmp/pack.json');
  add('    cd "$WORKSPACE_DIR"');
  add("    for filename in $(jq -r '.files | keys[]' /tmp/pack.json); do");
  add('      mkdir -p "$(dirname "$filename")"');
  add("      jq -r --arg f \"$filename\" '.files[$f]' /tmp/pack.json > \"$filename\"");
  add("    done");
  add("    rm /tmp/pack.json");
  add('    [ -d "$WORKSPACE_DIR/activity" ] && cp -r "$WORKSPACE_DIR/activity/"* /data/activity/ 2>/dev/null || true');
  add('    mkdir -p "$WORKSPACE_DIR/memory"');
  add('    rm -f "$WORKSPACE_DIR/configPatch.json"');
  add("  fi");
  add("fi");
  add("");
  add('GATEWAY_TOKEN="${GATEWAY_TOKEN:-$(openssl rand -hex 32)}"');
  add('[ ! -f "$CONFIG_FILE" ] && echo \'{}\' > "$CONFIG_FILE"');
  add("cat \"$CONFIG_FILE\" | jq --arg token \"$GATEWAY_TOKEN\" '. + {");
  add('  gateway: (.gateway // {} | . + {mode:"local",bind:"lan",auth:{mode:"token",token:$token},controlUi:{basePath:"/chat",allowInsecureAuth:true},trustedProxies:["127.0.0.1","::1","172.16.0.0/12","10.0.0.0/8"]}),');
  add('  browser: {executablePath:"/usr/bin/chromium"}');
  add("}' > \"${CONFIG_FILE}.tmp\" && mv \"${CONFIG_FILE}.tmp\" \"$CONFIG_FILE\"");
  add('chmod 600 "$CONFIG_FILE"');
  add("");
  add('exec $OPENCLAW_BIN gateway --port "${OPENCLAW_GATEWAY_PORT:-18789}" --verbose');
  add("OCENTRYPOINT");
  add("chmod +x /opt/capable/openclaw/entrypoint.sh");
  add("");

  // Dashboard systemd service — bare-metal (NOT Docker)
  add("cat > /etc/systemd/system/capable-dashboard.service << 'SYSTEMD'");
  add("[Unit]");
  add("Description=Capable.ai Dashboard");
  add("After=network.target docker.service");
  add("Wants=docker.service");
  add("");
  add("[Service]");
  add("Type=simple");
  add("WorkingDirectory=/opt/capable/dashboard");
  add("EnvironmentFile=/opt/capable/.env");
  add("Environment=NODE_ENV=production");
  add("Environment=PORT=3100");
  add("Environment=HOSTNAME=0.0.0.0");
  add("Environment=WS_TERMINAL_PORT=3101");
  add("Environment=DASHBOARD_RUNTIME=systemd");
  add("Environment=DATA_DIR=/opt/capable/data/activity");
  add("Environment=OPENCLAW_DIR=/opt/capable/openclaw-home");
  add("Environment=OPENCLAW_CONFIG=/opt/capable/openclaw-home/openclaw.json");
  add("Environment=OPENCLAW_GATEWAY_HOST=127.0.0.1");
  add("Environment=OPENCLAW_GATEWAY_PORT=18789");
  add("ExecStart=/bin/bash -c 'node scripts/ws-terminal-server.mjs & node scripts/bootstrap-pack.mjs && exec node apps/dashboard/server.js'");
  add("Restart=always");
  add("RestartSec=3");
  add("StandardOutput=journal");
  add("StandardError=journal");
  add("SyslogIdentifier=capable-dashboard");
  add("");
  add("[Install]");
  add("WantedBy=multi-user.target");
  add("SYSTEMD");
  add("systemctl daemon-reload");
  add('report "5-compose-files" "done"');
  add("");

  // Step 6: Caddy (subdomain only)
  if (hasSub) {
    add('echo ">>> [6/' + totalSteps + '] Configuring Caddy for ' + subdomain + '.capable.ai..."');
    add("cat > /opt/capable/caddy/Caddyfile << CADDYFILE");
    add(subdomain + ".capable.ai {");
    add("    tls /etc/caddy/certs/origin.crt /etc/caddy/certs/origin.key");
    add("");
    add("    # Terminal WebSocket → dashboard WS server (bare-metal on host)");
    add("    @terminal_ws {");
    add("        path /api/terminal/ws");
    add("        header Connection *Upgrade*");
    add("        header Upgrade websocket");
    add("    }");
    add("    handle @terminal_ws {");
    add("        reverse_proxy host.docker.internal:3101");
    add("    }");
    add("");
    add("    @websockets {");
    add("        header Connection *Upgrade*");
    add("        header Upgrade websocket");
    add("    }");
    add("    handle @websockets {");
    add("        reverse_proxy openclaw:18789 {");
    add("            header_down -X-Frame-Options");
    add("            header_down -Content-Security-Policy");
    add("        }");
    add("    }");
    add("");
    add("    handle /chat* {");
    add("        reverse_proxy openclaw:18789 {");
    add("            header_down -X-Frame-Options");
    add("            header_down -Content-Security-Policy");
    add("        }");
    add("    }");
    add("");
    add("    handle {");
    add("        reverse_proxy host.docker.internal:3100");
    add("    }");
    add("}");
    add("CADDYFILE");
    add("");
    add("openssl req -x509 -newkey rsa:2048 \\");
    add("  -keyout /opt/capable/caddy/certs/origin.key -out /opt/capable/caddy/certs/origin.crt \\");
    add("  -days 3650 -nodes \\");
    add("  -subj \"/CN=" + subdomain + ".capable.ai\" \\");
    add("  -addext \"subjectAltName=DNS:" + subdomain + ".capable.ai\" 2>/dev/null");
    add('report "6-caddy" "done"');
    add("");
  }

  // Build OpenClaw container and start everything
  const buildStep = hasSub ? 7 : 6;
  add('echo ">>> [' + buildStep + '/' + totalSteps + '] Building and starting services..."');
  add("cd /opt/capable");
  add("");
  add("# Build and start OpenClaw container (+ Caddy if subdomain)");
  add("docker compose build openclaw");
  add("docker compose up -d");
  add("");
  add("# Start dashboard via systemd (bare-metal)");
  add("systemctl enable --now capable-dashboard");
  add("");
  add("# Wait for services to be healthy");
  add("sleep 10");
  add("OPENCLAW_ACTIVE=false");
  add("for i in 1 2 3 4 5; do");
  add("  if curl -sf http://localhost:18789/ > /dev/null 2>&1; then");
  add('    echo "  OpenClaw gateway is running"');
  add("    OPENCLAW_ACTIVE=true");
  add("    break");
  add("  fi");
  add('  echo "  Waiting for OpenClaw to start (attempt $i)..."');
  add("  sleep 5");
  add("done");
  add('if [ "$OPENCLAW_ACTIVE" = "false" ]; then');
  add('  echo "  WARNING: OpenClaw gateway may not be running"');
  add('  docker logs capable-openclaw 2>&1 | tail -30');
  add('  report "' + buildStep + '-services" "warning" "openclaw may not be running"');
  add("fi");
  add('report "' + buildStep + '-services" "done"');
  add("");

  // Heartbeat + deploy script
  const hbStep = hasSub ? 8 : 7;
  add('echo ">>> [' + hbStep + '/' + totalSteps + '] Setting up heartbeat and deploy script..."');
  add("curl -sf -X POST " + appUrl + "/api/deployments/heartbeat \\");
  add('  -H "Content-Type: application/json" \\');
  add("  -d '{\"projectToken\":\"" + projectToken + "\",\"dropletIp\":\"'\"$DROPLET_IP\"'\",\"packVersion\":" + packVersion + ",\"status\":\"active\",\"dashboardPassword\":\"'\"$DASH_PASSWORD\"'\",\"adminSecret\":\"'\"$ADMIN_SECRET\"'\",\"gatewayToken\":\"'\"$GATEWAY_TOKEN\"'\"}' || true");
  add("");

  // Heartbeat script — captures response and writes subscription status to disk
  add("cat > /opt/capable/heartbeat.sh << 'HBSCRIPT'");
  add("#!/bin/bash");
  add("DROPLET_IP=$(/usr/bin/curl -4 -s ifconfig.me)");
  add("RESPONSE=$(/usr/bin/curl -sf -X POST " + appUrl + "/api/deployments/heartbeat \\");
  add("  -H \"Content-Type: application/json\" \\");
  add("  -d \"{\\\"projectToken\\\":\\\"" + projectToken + "\\\",\\\"dropletIp\\\":\\\"$DROPLET_IP\\\",\\\"packVersion\\\":" + packVersion + ",\\\"status\\\":\\\"active\\\"}\")");
  add("if [ -n \"$RESPONSE\" ]; then");
  add("  echo \"$RESPONSE\" | /usr/bin/python3 -c '");
  add("import sys, json");
  add("try:");
  add("    d = json.load(sys.stdin)");
  add("    s = d.get(\"subscription\")");
  add("    if s:");
  add("        open(\"/opt/capable/.subscription-status.json\",\"w\").write(json.dumps(s))");
  add("except:");
  add("    pass");
  add("' 2>/dev/null");
  add("fi");
  add("HBSCRIPT");
  add("chmod +x /opt/capable/heartbeat.sh");
  add("");

  // Deploy script — for manual upgrades and auto-deploy
  add("cat > /opt/capable/deploy-dashboard.sh << 'DEPLOYSCRIPT'");
  add("#!/bin/bash");
  add('set -euo pipefail');
  add('ASSET_ID="${1:?Usage: deploy-dashboard.sh <GITHUB_ASSET_ID>}"');
  add('GH_TOKEN="${GH_TOKEN:?Set GH_TOKEN env var}"');
  add('INSTALL_DIR="/opt/capable/dashboard"');
  add('BACKUP_DIR="/opt/capable/dashboard.backup"');
  add('echo ">>> Downloading asset $ASSET_ID..."');
  add('curl -fSL -H "Authorization: token $GH_TOKEN" -H "Accept: application/octet-stream" \\');
  add('  "https://api.github.com/repos/iGOTHAM/capable-ai-2.0/releases/assets/$ASSET_ID" \\');
  add('  -o /tmp/dashboard-upgrade.tar.gz');
  add('echo ">>> Backing up current dashboard..."');
  add('rm -rf "$BACKUP_DIR"');
  add('cp -a "$INSTALL_DIR" "$BACKUP_DIR"');
  add('echo ">>> Extracting new dashboard..."');
  add('rm -rf "$INSTALL_DIR"/*');
  add('tar -xzf /tmp/dashboard-upgrade.tar.gz -C "$INSTALL_DIR"');
  add('echo ">>> Installing native dependencies..."');
  add('cd "$INSTALL_DIR" && npm install --no-save node-pty ws');
  add('echo ">>> Restarting dashboard..."');
  add('systemctl restart capable-dashboard');
  add('sleep 2');
  add('if systemctl is-active --quiet capable-dashboard; then');
  add('  echo ">>> Dashboard upgraded successfully"');
  add("else");
  add('  echo ">>> Dashboard failed to start, rolling back..."');
  add('  rm -rf "$INSTALL_DIR"');
  add('  mv "$BACKUP_DIR" "$INSTALL_DIR"');
  add('  systemctl restart capable-dashboard');
  add('  echo ">>> Rollback complete"');
  add('  exit 1');
  add("fi");
  add('rm -f /tmp/dashboard-upgrade.tar.gz');
  add('echo ">>> Done"');
  add("DEPLOYSCRIPT");
  add("chmod +x /opt/capable/deploy-dashboard.sh");
  add("");

  add("cat > /etc/cron.d/capable-heartbeat << 'CRON'");
  add("*/5 * * * * root /opt/capable/heartbeat.sh > /dev/null 2>&1");
  add("CRON");
  add("chmod 644 /etc/cron.d/capable-heartbeat");
  add("");

  // Firewall
  add("# Firewall");
  add("ufw default deny incoming");
  add("ufw default allow outgoing");
  add("ufw allow 22/tcp");
  if (hasSub) {
    add("ufw allow 80/tcp");
    add("ufw allow 443/tcp");
  } else {
    add("ufw allow 3100/tcp");
  }
  add("ufw --force enable");
  add("# Allow Docker containers to reach host services (dashboard on port 3100)");
  add("iptables -I INPUT -i br-+ -j ACCEPT");
  add("# Persist the rule across reboots via UFW after.rules");
  add("grep -q 'br-+ -j ACCEPT' /etc/ufw/after.rules || sed -i '/COMMIT/i -A ufw-after-input -i br-+ -j ACCEPT' /etc/ufw/after.rules");
  add("");

  add('echo ""');
  add('echo "========================================="');
  add('echo "  Capable.ai deployment complete!"');
  add('echo "========================================="');
  add('echo "  Dashboard: ' + dashboardUrl + '"');
  if (hasSub) {
    add('echo "  Chat:      ' + dashboardUrl + '/chat/"');
  }
  add('echo "  Password:  $DASH_PASSWORD"');
  add('echo ""');
  add('echo "  Your AI provider will be configured"');
  add('echo "  automatically from the deploy page."');
  add('echo ""');
  add('echo "  Credentials saved to:"');
  add('echo "  /root/dashboard-credentials.txt"');
  add('echo "========================================="');
  add('report "cloud-init" "completed"');

  return L.join("\n");
}
