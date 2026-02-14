/**
 * Capable.ai — Cloud-Init Generator (CLI)
 *
 * Generates a cloud-init script that deploys the full Capable.ai stack
 * using Docker Compose (Dashboard + OpenClaw + Caddy).
 *
 * Usage: npx tsx scripts/cloud-init-generator.ts \
 *   --app-url https://capable.ai \
 *   --project-id <id> \
 *   --project-token <token> \
 *   --pack-version 1 \
 *   --subdomain <optional> \
 *   --output cloud-init.sh
 */

import { writeFileSync } from "fs";

interface Params {
  appUrl: string;
  projectId: string;
  projectToken: string;
  packVersion: number;
  subdomain: string;
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
      "  --subdomain <optional> \\\n" +
      "  --output <filename>",
    );
    process.exit(1);
  }

  return {
    appUrl: params["app-url"],
    projectId: params["project-id"],
    projectToken: params["project-token"],
    packVersion: parseInt(params["pack-version"] || "1", 10),
    subdomain: params["subdomain"] || "",
    output: params["output"] || "cloud-init.sh",
  };
}

// All shell content uses plain strings (no template literals) to avoid
// conflicts with shell $() backticks and ${} variable syntax.

function generateScript(p: Params): string {
  const hasSub = !!p.subdomain;
  const dashboardUrl = hasSub
    ? "https://" + p.subdomain + ".capable.ai"
    : "http://$DROPLET_IP:3100";

  const lines: string[] = [];
  const L = (s: string) => lines.push(s);

  L("#!/bin/bash");
  L("# =========================================");
  L("# Capable.ai — Cloud-Init Script (Docker)");
  L("# Generated for project: " + p.projectId);
  L("# Deploy method: Docker Compose (portable)");
  L("# =========================================");
  L("");
  L("set -euo pipefail");
  L("export DEBIAN_FRONTEND=noninteractive");
  L("");
  L('echo ">>> [1/6] Installing Docker..."');
  L("curl -fsSL https://get.docker.com | sh");
  L("");
  L('echo ">>> [2/6] Setting up deployment directory..."');
  L("mkdir -p /opt/capable/caddy/certs");
  L("mkdir -p /opt/capable/openclaw");
  L("");
  L('echo ">>> [3/6] Generating configuration..."');
  L("DASH_PASSWORD=$(openssl rand -base64 16)");
  L("GATEWAY_TOKEN=$(openssl rand -hex 32)");
  L("DROPLET_IP=$(curl -4 -s ifconfig.me)");
  L("");
  L("cat > /opt/capable/.env << ENV");
  L("PROJECT_ID=" + p.projectId);
  L("PROJECT_TOKEN=" + p.projectToken);
  L("PACK_VERSION=" + p.packVersion);
  L("AUTH_PASSWORD=$DASH_PASSWORD");
  L("GATEWAY_TOKEN=$GATEWAY_TOKEN");
  L("SUBDOMAIN=" + p.subdomain);
  L("OPENCLAW_VERSION=2026.2.6-3");
  L("NEXT_PUBLIC_APP_URL=" + p.appUrl);
  L("ENV");
  L("");
  L("cat > /root/dashboard-credentials.txt << CREDENTIALS");
  L("Capable Dashboard Credentials");
  L("==============================");
  L("URL:      " + dashboardUrl);
  L("Password: $DASH_PASSWORD");
  L("Gateway:  $GATEWAY_TOKEN");
  L('Created:  $(date -u +"%Y-%m-%d %H:%M:%S UTC")');
  L("CREDENTIALS");
  L("chmod 600 /root/dashboard-credentials.txt");
  L("");
  L('echo ">>> [4/6] Writing Docker Compose configuration..."');

  // docker-compose.yml (heredoc with quoting to prevent expansion)
  L("cat > /opt/capable/docker-compose.yml << 'COMPOSE'");
  L("services:");
  L("  dashboard:");
  L("    image: capable-ai/dashboard:latest");
  L("    container_name: capable-dashboard");
  L("    restart: unless-stopped");
  L("    ports:");
  L('      - "3100:3100"');
  L("    volumes:");
  L("      - activity-data:/data/activity");
  L("    environment:");
  L("      - NODE_ENV=production");
  L("      - PORT=3100");
  L("      - HOSTNAME=0.0.0.0");
  L("      - AUTH_PASSWORD=${AUTH_PASSWORD}");
  L("      - DATA_DIR=/data/activity");
  L("      - OPENCLAW_GATEWAY_HOST=openclaw");
  L("    depends_on:");
  L("      openclaw:");
  L("        condition: service_started");
  L("");
  L("  openclaw:");
  L("    build:");
  L("      context: ./openclaw");
  L("      args:");
  L("        OPENCLAW_VERSION: ${OPENCLAW_VERSION:-2026.2.6-3}");
  L("    container_name: capable-openclaw");
  L("    restart: unless-stopped");
  L("    volumes:");
  L("      - openclaw-workspace:/root/.openclaw/workspace");
  L("      - openclaw-config:/root/.openclaw");
  L("      - activity-data:/data/activity");
  L("    environment:");
  L("      - PROJECT_ID=${PROJECT_ID}");
  L("      - PROJECT_TOKEN=${PROJECT_TOKEN}");
  L("      - PACK_VERSION=${PACK_VERSION:-1}");
  L("      - NEXT_PUBLIC_APP_URL=${NEXT_PUBLIC_APP_URL:-https://capable.ai}");
  L("      - GATEWAY_TOKEN=${GATEWAY_TOKEN}");
  L("      - OPENCLAW_GATEWAY_PORT=18789");
  L("    expose:");
  L('      - "18789"');

  if (hasSub) {
    L("");
    L("  caddy:");
    L("    image: caddy:2-alpine");
    L("    container_name: capable-caddy");
    L("    restart: unless-stopped");
    L("    ports:");
    L('      - "80:80"');
    L('      - "443:443"');
    L("    volumes:");
    L("      - ./caddy/Caddyfile:/etc/caddy/Caddyfile:ro");
    L("      - caddy-data:/data");
    L("      - caddy-config:/config");
    L("      - ./caddy/certs:/etc/caddy/certs:ro");
    L("    environment:");
    L("      - CAPABLE_SUBDOMAIN=${SUBDOMAIN:-localhost}");
    L("    depends_on:");
    L("      - dashboard");
    L("      - openclaw");
  }

  L("");
  L("volumes:");
  L("  activity-data:");
  L("  openclaw-workspace:");
  L("  openclaw-config:");
  if (hasSub) {
    L("  caddy-data:");
    L("  caddy-config:");
  }
  L("COMPOSE");
  L("");

  // OpenClaw Dockerfile
  L("cat > /opt/capable/openclaw/Dockerfile << 'OCDOCKER'");
  L("FROM node:22-bookworm-slim");
  L("RUN apt-get update && apt-get install -y --no-install-recommends \\");
  L("    chromium curl jq openssl unzip python3 git wget && rm -rf /var/lib/apt/lists/*");
  L("ENV CHROME_PATH=/usr/bin/chromium");
  L("ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium");
  L("ENV PUPPETEER_CHROMIUM_REVISION=skip");
  L("ARG OPENCLAW_VERSION=2026.2.6-3");
  L("RUN npm install -g openclaw@${OPENCLAW_VERSION}");
  L("RUN mkdir -p /root/.openclaw/workspace /data/activity");
  L("COPY entrypoint.sh /entrypoint.sh");
  L("RUN chmod +x /entrypoint.sh");
  L("ENV OPENCLAW_GATEWAY_PORT=18789");
  L("EXPOSE 18789");
  L('ENTRYPOINT ["/entrypoint.sh"]');
  L("OCDOCKER");
  L("");

  // OpenClaw entrypoint
  L("cat > /opt/capable/openclaw/entrypoint.sh << 'OCENTRYPOINT'");
  L("#!/bin/bash");
  L("set -e");
  L("OPENCLAW_BIN=$(npm prefix -g)/bin/openclaw");
  L('WORKSPACE_DIR="${WORKSPACE_DIR:-/root/.openclaw/workspace}"');
  L('CONFIG_FILE="/root/.openclaw/openclaw.json"');
  L("");
  L('if [ -n "$PROJECT_ID" ] && [ -n "$PROJECT_TOKEN" ]; then');
  L('  APP_URL="${NEXT_PUBLIC_APP_URL:-https://capable.ai}"');
  L('  PACK_URL=$(curl -sf -X POST "${APP_URL}/api/packs/${PROJECT_ID}/download-url" \\');
  L('    -H "Content-Type: application/json" \\');
  L('    -d "{\\"version\\":${PACK_VERSION:-1},\\"projectToken\\":\\"${PROJECT_TOKEN}\\"}" | jq -r \'.url\')');
  L('  if [ -n "$PACK_URL" ] && [ "$PACK_URL" != "null" ]; then');
  L('    curl -fsSL "${PACK_URL}&format=json" -o /tmp/pack.json');
  L('    cd "$WORKSPACE_DIR"');
  L("    for filename in $(jq -r '.files | keys[]' /tmp/pack.json); do");
  L('      mkdir -p "$(dirname "$filename")"');
  L("      jq -r --arg f \"$filename\" '.files[$f]' /tmp/pack.json > \"$filename\"");
  L("    done");
  L("    rm /tmp/pack.json");
  L('    [ -d "$WORKSPACE_DIR/activity" ] && cp -r "$WORKSPACE_DIR/activity/"* /data/activity/ 2>/dev/null || true');
  L('    mkdir -p "$WORKSPACE_DIR/memory"');
  L('    rm -f "$WORKSPACE_DIR/configPatch.json"');
  L("  fi");
  L("fi");
  L("");
  L('GATEWAY_TOKEN="${GATEWAY_TOKEN:-$(openssl rand -hex 32)}"');
  L('[ ! -f "$CONFIG_FILE" ] && echo \'{}\' > "$CONFIG_FILE"');
  L("cat \"$CONFIG_FILE\" | jq --arg token \"$GATEWAY_TOKEN\" '. + {");
  L('  gateway: (.gateway // {} | . + {mode:"local",auth:{mode:"token",token:$token},controlUi:{basePath:"/chat",allowInsecureAuth:true},trustedProxies:["127.0.0.1","::1","172.16.0.0/12","10.0.0.0/8"]}),');
  L('  browser: {executablePath:"/usr/bin/chromium"}');
  L("}' > \"${CONFIG_FILE}.tmp\" && mv \"${CONFIG_FILE}.tmp\" \"$CONFIG_FILE\"");
  L('chmod 600 "$CONFIG_FILE"');
  L("");
  L('exec $OPENCLAW_BIN gateway --port "${OPENCLAW_GATEWAY_PORT:-18789}" --verbose');
  L("OCENTRYPOINT");
  L("chmod +x /opt/capable/openclaw/entrypoint.sh");
  L("");

  // Caddy configuration (subdomain only)
  if (hasSub) {
    L("cat > /opt/capable/caddy/Caddyfile << CADDYFILE");
    L(p.subdomain + ".capable.ai {");
    L("    tls /etc/caddy/certs/origin.crt /etc/caddy/certs/origin.key");
    L("");
    L("    @websockets {");
    L("        header Connection *Upgrade*");
    L("        header Upgrade websocket");
    L("    }");
    L("    handle @websockets {");
    L("        reverse_proxy openclaw:18789");
    L("    }");
    L("");
    L("    handle /chat* {");
    L("        reverse_proxy openclaw:18789");
    L("    }");
    L("");
    L("    handle {");
    L("        reverse_proxy dashboard:3100");
    L("    }");
    L("}");
    L("CADDYFILE");
    L("");
    L("openssl req -x509 -newkey rsa:2048 \\");
    L("  -keyout /opt/capable/caddy/certs/origin.key -out /opt/capable/caddy/certs/origin.crt \\");
    L("  -days 3650 -nodes \\");
    L("  -subj \"/CN=" + p.subdomain + ".capable.ai\" \\");
    L("  -addext \"subjectAltName=DNS:" + p.subdomain + ".capable.ai\" 2>/dev/null");
    L("");
  }

  L('echo ">>> [5/6] Starting services..."');
  L("cd /opt/capable");
  L("docker compose build openclaw");
  L(hasSub ? "docker compose up -d" : "docker compose up -d dashboard openclaw");
  L("");
  L('echo ">>> [6/6] Setting up heartbeat..."');
  L("curl -sf -X POST " + p.appUrl + "/api/deployments/heartbeat \\");
  L('  -H "Content-Type: application/json" \\');
  L("  -d '{\"projectToken\":\"" + p.projectToken + "\",\"dropletIp\":\"'\"$DROPLET_IP\"'\",\"packVersion\":" + p.packVersion + ",\"status\":\"active\",\"dashboardPassword\":\"'\"$DASH_PASSWORD\"'\",\"gatewayToken\":\"'\"$GATEWAY_TOKEN\"'\"}' || true");
  L("");
  L("cat > /etc/cron.d/capable-heartbeat << 'CRON'");
  L("*/5 * * * * root DROPLET_IP=$(/usr/bin/curl -4 -s ifconfig.me); /usr/bin/curl -sf -X POST " + p.appUrl + "/api/deployments/heartbeat -H \"Content-Type: application/json\" -d \"{\\\"projectToken\\\":\\\"" + p.projectToken + "\\\",\\\"dropletIp\\\":\\\"$DROPLET_IP\\\",\\\"packVersion\\\":" + p.packVersion + ",\\\"status\\\":\\\"active\\\"}\" > /dev/null 2>&1");
  L("CRON");
  L("chmod 644 /etc/cron.d/capable-heartbeat");
  L("");
  L('echo ""');
  L('echo "========================================="');
  L('echo "  Capable.ai deployment complete!"');
  L('echo "========================================="');
  L('echo "  Dashboard: ' + dashboardUrl + '"');
  if (hasSub) {
    L('echo "  Chat:      ' + dashboardUrl + '/chat/"');
  }
  L('echo "  Password:  $DASH_PASSWORD"');
  L('echo ""');
  L('echo "  Credentials saved to:"');
  L('echo "  /root/dashboard-credentials.txt"');
  L('echo "========================================="');

  return lines.join("\n");
}

const params = parseArgs();
const script = generateScript(params);
writeFileSync(params.output, script, { mode: 0o755 });
console.log("Cloud-init script written to " + params.output);
