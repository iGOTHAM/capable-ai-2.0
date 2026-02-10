#!/bin/bash
# =========================================
# Capable.ai — One-line VPS Installer
# Works on any VPS: DigitalOcean, Hostinger, AWS, etc.
#
# Usage (from deploy/ directory):
#   chmod +x install.sh && ./install.sh
# =========================================

set -e

echo "========================================="
echo "  Capable.ai — VPS Installer"
echo "========================================="
echo ""

# ─── 1. Install Docker if missing ───
if ! command -v docker &> /dev/null; then
    echo ">>> Installing Docker..."
    curl -fsSL https://get.docker.com | sh
    echo ">>> Docker installed."
else
    echo ">>> Docker already installed: $(docker --version)"
fi

# Ensure docker compose plugin is available
if ! docker compose version &> /dev/null; then
    echo ">>> ERROR: docker compose plugin not found."
    echo ">>> Please install Docker Compose v2: https://docs.docker.com/compose/install/"
    exit 1
fi

# ─── 2. Setup directory ───
INSTALL_DIR="/opt/capable"
mkdir -p "$INSTALL_DIR"

# Copy deployment files if running from the deploy/ directory
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
if [ "$SCRIPT_DIR" != "$INSTALL_DIR" ]; then
    echo ">>> Copying deployment files to $INSTALL_DIR..."
    cp -r "$SCRIPT_DIR"/* "$INSTALL_DIR/" 2>/dev/null || true
    cp "$SCRIPT_DIR"/.env.example "$INSTALL_DIR/" 2>/dev/null || true
    # Don't overwrite existing .env
    [ -f "$INSTALL_DIR/.env" ] || cp "$SCRIPT_DIR"/.env "$INSTALL_DIR/" 2>/dev/null || true
fi

cd "$INSTALL_DIR"

# ─── 3. Configure if .env doesn't exist ───
if [ ! -f .env ]; then
    echo ""
    echo ">>> First-time setup — configuring your deployment..."
    echo ""

    read -p "  Project ID: " PROJECT_ID
    read -p "  Project Token: " PROJECT_TOKEN
    read -p "  Subdomain (leave empty for IP-only access): " SUBDOMAIN

    # Generate secrets
    AUTH_PASSWORD=$(openssl rand -base64 16)
    GATEWAY_TOKEN=$(openssl rand -hex 32)

    cat > .env << ENV
PROJECT_ID=$PROJECT_ID
PROJECT_TOKEN=$PROJECT_TOKEN
AUTH_PASSWORD=$AUTH_PASSWORD
GATEWAY_TOKEN=$GATEWAY_TOKEN
SUBDOMAIN=$SUBDOMAIN
PACK_VERSION=1
OPENCLAW_VERSION=2026.2.6-3
NEXT_PUBLIC_APP_URL=https://capable.ai
ENV

    echo ""
    echo ">>> Configuration saved to .env"
fi

# Source .env for use in this script
set -a; source .env; set +a

# ─── 4. Generate self-signed origin cert (for Caddy + Cloudflare) ───
if [ -n "$SUBDOMAIN" ]; then
    mkdir -p caddy/certs
    if [ ! -f caddy/certs/origin.crt ]; then
        echo ">>> Generating self-signed origin certificate for ${SUBDOMAIN}.capable.ai..."
        openssl req -x509 -newkey rsa:2048 \
            -keyout caddy/certs/origin.key -out caddy/certs/origin.crt \
            -days 3650 -nodes \
            -subj "/CN=${SUBDOMAIN}.capable.ai" \
            -addext "subjectAltName=DNS:${SUBDOMAIN}.capable.ai" 2>/dev/null
        echo ">>> Certificate generated."
    fi
fi

# ─── 5. Build OpenClaw image ───
echo ">>> Building OpenClaw container..."
docker compose build openclaw

# ─── 6. Start services ───
echo ">>> Starting all services..."
if [ -n "$SUBDOMAIN" ]; then
    # Full stack with Caddy
    docker compose up -d
else
    # No subdomain — skip Caddy, expose dashboard directly
    docker compose up -d dashboard openclaw
fi

# ─── 7. Setup heartbeat cron ───
DROPLET_IP=$(curl -4 -s ifconfig.me 2>/dev/null || echo "unknown")

if [ "$DROPLET_IP" != "unknown" ] && [ -n "$PROJECT_TOKEN" ]; then
    echo ">>> Sending initial heartbeat..."
    curl -sf -X POST "${NEXT_PUBLIC_APP_URL:-https://capable.ai}/api/deployments/heartbeat" \
        -H "Content-Type: application/json" \
        -d "{\"projectToken\":\"$PROJECT_TOKEN\",\"dropletIp\":\"$DROPLET_IP\",\"packVersion\":${PACK_VERSION:-1},\"status\":\"active\",\"dashboardPassword\":\"$AUTH_PASSWORD\",\"gatewayToken\":\"$GATEWAY_TOKEN\"}" || true

    # Setup recurring heartbeat
    cat > /etc/cron.d/capable-heartbeat << CRON
*/5 * * * * root DROPLET_IP=\$(/usr/bin/curl -4 -s ifconfig.me); /usr/bin/curl -sf -X POST ${NEXT_PUBLIC_APP_URL:-https://capable.ai}/api/deployments/heartbeat -H "Content-Type: application/json" -d "{\"projectToken\":\"$PROJECT_TOKEN\",\"dropletIp\":\"\$DROPLET_IP\",\"packVersion\":${PACK_VERSION:-1},\"status\":\"active\"}" > /dev/null 2>&1
CRON
    chmod 644 /etc/cron.d/capable-heartbeat
fi

# ─── 8. Done ───
echo ""
echo "========================================="
echo "  Capable.ai is running!"
echo "========================================="
if [ -n "$SUBDOMAIN" ]; then
    echo "  Dashboard: https://${SUBDOMAIN}.capable.ai"
    echo "  Chat:      https://${SUBDOMAIN}.capable.ai/chat/"
else
    echo "  Dashboard: http://${DROPLET_IP}:3100"
fi
echo "  Password:  $AUTH_PASSWORD"
echo ""
echo "  Credentials saved to: $INSTALL_DIR/.env"
echo ""
echo "  Manage with:"
echo "    cd $INSTALL_DIR"
echo "    docker compose logs -f        # View logs"
echo "    docker compose restart         # Restart services"
echo "    docker compose down            # Stop services"
echo "    docker compose up -d           # Start services"
echo "========================================="
