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
 * Generate a cloud-init bash script that deploys the full Capable.ai stack
 * using Docker Compose (Dashboard + OpenClaw + Caddy).
 *
 * This replaces the previous bare-metal/systemd approach with containers
 * for portability across VPS providers.
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

  // Build the script using string arrays to avoid template-literal escaping issues
  const L: string[] = [];
  const add = (s: string) => L.push(s);

  add("#!/bin/bash");
  add("# =========================================");
  add("# Capable.ai — Cloud-Init Script (Docker)");
  add("# Generated for project: " + projectId);
  add("# Deploy method: Docker Compose (portable)");
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

  // Step 2: Install Docker
  add('echo ">>> [2/' + totalSteps + '] Installing Docker..."');
  add("curl -fsSL https://get.docker.com | sh");
  add('report "2-docker" "done"');
  add("");

  // Step 3: Setup directory + download dashboard tarball
  add('echo ">>> [3/' + totalSteps + '] Downloading pre-built dashboard..."');
  add("mkdir -p /opt/capable/caddy/certs");
  add("mkdir -p /opt/capable/openclaw");
  add('curl -fsSL "' + dashboardTarballUrl + '" -o /tmp/dashboard.tar.gz');
  add("mkdir -p /opt/capable/dashboard-build");
  add("tar -xzf /tmp/dashboard.tar.gz -C /opt/capable/dashboard-build");
  add("rm /tmp/dashboard.tar.gz");
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
  // This lets the UI show progress instead of appearing stuck
  add("# Send early heartbeat so the deploy page shows progress");
  add("curl -sf -X POST " + appUrl + "/api/deployments/heartbeat \\");
  add('  -H "Content-Type: application/json" \\');
  add("  -d '{\"projectToken\":\"" + projectToken + "\",\"dropletIp\":\"'\"$DROPLET_IP\"'\",\"packVersion\":" + packVersion + ",\"status\":\"provisioning\",\"dashboardPassword\":\"'\"$DASH_PASSWORD\"'\",\"adminSecret\":\"'\"$ADMIN_SECRET\"'\",\"gatewayToken\":\"'\"$GATEWAY_TOKEN\"'\"}' || true");
  add("");

  // Step 5: Write Docker Compose + container files
  add('echo ">>> [5/' + totalSteps + '] Writing Docker Compose configuration..."');
  add("");

  // docker-compose.yml (single-quoted heredoc — no shell expansion)
  add("cat > /opt/capable/docker-compose.yml << 'COMPOSE'");
  add("services:");
  add("  dashboard:");
  add("    image: capable-ai/dashboard:latest");
  add("    container_name: capable-dashboard");
  add("    restart: unless-stopped");
  if (hasSub) {
    add("    expose:");
    add('      - "3100"');
    add('      - "3101"');
  } else {
    add("    ports:");
    add('      - "3100:3100"');
    add("    expose:");
    add('      - "3101"');
  }
  add("    volumes:");
  add("      - activity-data:/data/activity");
  add("      - openclaw-config:/root/.openclaw");
  add("      - /var/run/docker.sock:/var/run/docker.sock");
  add("      - /opt/capable/.env:/opt/capable/.env");
  add("    environment:");
  add("      - NODE_ENV=production");
  add("      - PORT=3100");
  add("      - HOSTNAME=0.0.0.0");
  add("      - AUTH_PASSWORD=${AUTH_PASSWORD}");
  add("      - ADMIN_SECRET=${ADMIN_SECRET}");
  add("      - GATEWAY_TOKEN=${GATEWAY_TOKEN}");
  add("      - DATA_DIR=/data/activity");
  add("      - OPENCLAW_GATEWAY_HOST=openclaw");
  add("      - OPENCLAW_GATEWAY_PORT=18789");
  add("      - OPENCLAW_CONFIG=/root/.openclaw/openclaw.json");
  add("      - OPENCLAW_DIR=/root/.openclaw");
  add("      - CONTAINER_MODE=docker");
  add("      - WS_TERMINAL_PORT=3101");
  add("    depends_on:");
  add("      openclaw:");
  add("        condition: service_started");
  add("");
  add("  openclaw:");
  add("    build:");
  add("      context: ./openclaw");
  add("      args:");
  add("        OPENCLAW_VERSION: ${OPENCLAW_VERSION:-2026.2.6-3}");
  add("    container_name: capable-openclaw");
  add("    restart: unless-stopped");
  add("    volumes:");
  add("      - openclaw-workspace:/root/.openclaw/workspace");
  add("      - openclaw-config:/root/.openclaw");
  add("      - activity-data:/data/activity");
  add("    environment:");
  add("      - PROJECT_ID=${PROJECT_ID}");
  add("      - PROJECT_TOKEN=${PROJECT_TOKEN}");
  add("      - PACK_VERSION=${PACK_VERSION:-1}");
  add("      - NEXT_PUBLIC_APP_URL=${NEXT_PUBLIC_APP_URL:-https://capable.ai}");
  add("      - GATEWAY_TOKEN=${GATEWAY_TOKEN}");
  add("      - OPENCLAW_GATEWAY_PORT=18789");
  add("    expose:");
  add('      - "18789"');

  if (hasSub) {
    add("");
    add("  caddy:");
    add("    image: caddy:2-alpine");
    add("    container_name: capable-caddy");
    add("    restart: unless-stopped");
    add("    ports:");
    add('      - "80:80"');
    add('      - "443:443"');
    add("    volumes:");
    add("      - ./caddy/Caddyfile:/etc/caddy/Caddyfile:ro");
    add("      - caddy-data:/data");
    add("      - caddy-config:/config");
    add("      - ./caddy/certs:/etc/caddy/certs:ro");
    add("    environment:");
    add("      - CAPABLE_SUBDOMAIN=${SUBDOMAIN:-localhost}");
    add("    depends_on:");
    add("      - dashboard");
    add("      - openclaw");
  }

  add("");
  add("volumes:");
  add("  activity-data:");
  add("  openclaw-workspace:");
  add("  openclaw-config:");
  if (hasSub) {
    add("  caddy-data:");
    add("  caddy-config:");
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
  add('report "5-compose-files" "done"');
  add("");

  // Step 6: Caddy (subdomain only)
  if (hasSub) {
    add('echo ">>> [6/' + totalSteps + '] Configuring Caddy for ' + subdomain + '.capable.ai..."');
    add("cat > /opt/capable/caddy/Caddyfile << CADDYFILE");
    add(subdomain + ".capable.ai {");
    add("    tls /etc/caddy/certs/origin.crt /etc/caddy/certs/origin.key");
    add("");
    add("    # Terminal WebSocket → dashboard sidecar (must be before generic @websockets)");
    add("    @terminal_ws {");
    add("        path /api/terminal/ws");
    add("        header Connection *Upgrade*");
    add("        header Upgrade websocket");
    add("    }");
    add("    handle @terminal_ws {");
    add("        reverse_proxy dashboard:3101");
    add("    }");
    add("");
    add("    @websockets {");
    add("        header Connection *Upgrade*");
    add("        header Upgrade websocket");
    add("    }");
    add("    handle @websockets {");
    add("        reverse_proxy openclaw:18789");
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
    add("        reverse_proxy dashboard:3100");
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

  // Build dashboard Docker image from tarball
  const buildStep = hasSub ? 7 : 6;
  add('echo ">>> [' + buildStep + '/' + totalSteps + '] Building and starting containers..."');
  add("cd /opt/capable");
  add("");
  add("# Build dashboard image from the downloaded standalone tarball");
  add("cat > /opt/capable/Dockerfile.dashboard << 'DASHDOCKER'");
  add("FROM node:22-alpine");
  add("WORKDIR /app");
  add("RUN apk add --no-cache curl docker-cli python3 make g++ libc6-compat");
  add("COPY dashboard-build/ ./");
  add("# Install native modules for terminal WebSocket server");
  add("RUN npm install --no-save node-pty ws");
  add("RUN apk del python3 make g++");
  add("RUN mkdir -p /data/activity /root/.openclaw");
  add("EXPOSE 3100 3101");
  add("ENV PORT=3100 HOSTNAME=0.0.0.0 NODE_ENV=production WS_TERMINAL_PORT=3101");
  add('CMD ["sh", "-c", "node scripts/ws-terminal-server.mjs & node scripts/bootstrap-pack.mjs && node apps/dashboard/server.js"]');
  add("DASHDOCKER");
  add("");
  add("docker build -f Dockerfile.dashboard -t capable-ai/dashboard:latest .");
  add("docker compose build openclaw");
  add(hasSub ? "docker compose up -d" : "docker compose up -d dashboard openclaw");
  add("");
  add("# Wait for containers to be healthy");
  add("sleep 10");
  add("OPENCLAW_ACTIVE=false");
  add("for i in 1 2 3 4 5; do");
  add("  if docker exec capable-openclaw curl -sf http://localhost:18789/ > /dev/null 2>&1; then");
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
  add('  report "' + buildStep + '-containers" "warning" "openclaw may not be running"');
  add("fi");
  add('report "' + buildStep + '-containers" "done"');
  add("");

  // Heartbeat
  const hbStep = hasSub ? 8 : 7;
  add('echo ">>> [' + hbStep + '/' + totalSteps + '] Setting up heartbeat..."');
  add("curl -sf -X POST " + appUrl + "/api/deployments/heartbeat \\");
  add('  -H "Content-Type: application/json" \\');
  add("  -d '{\"projectToken\":\"" + projectToken + "\",\"dropletIp\":\"'\"$DROPLET_IP\"'\",\"packVersion\":" + packVersion + ",\"status\":\"active\",\"dashboardPassword\":\"'\"$DASH_PASSWORD\"'\",\"adminSecret\":\"'\"$ADMIN_SECRET\"'\",\"gatewayToken\":\"'\"$GATEWAY_TOKEN\"'\"}' || true");
  add("");
  add("cat > /etc/cron.d/capable-heartbeat << 'CRON'");
  add("*/5 * * * * root DROPLET_IP=$(/usr/bin/curl -4 -s ifconfig.me); /usr/bin/curl -sf -X POST " + appUrl + "/api/deployments/heartbeat -H \"Content-Type: application/json\" -d \"{\\\"projectToken\\\":\\\"" + projectToken + "\\\",\\\"dropletIp\\\":\\\"$DROPLET_IP\\\",\\\"packVersion\\\":" + packVersion + ",\\\"status\\\":\\\"active\\\"}\" > /dev/null 2>&1");
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
    // Port 3100 not exposed to host when Caddy is present — no deny needed
  } else {
    add("ufw allow 3100/tcp");
  }
  add("ufw --force enable");
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
