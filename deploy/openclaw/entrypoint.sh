#!/bin/bash
set -e

OPENCLAW_BIN=$(npm prefix -g)/bin/openclaw
WORKSPACE_DIR="${WORKSPACE_DIR:-/root/.openclaw/workspace}"
CONFIG_FILE="/root/.openclaw/openclaw.json"

echo ">>> [OpenClaw] Starting entrypoint..."

# ─── 1. Download pack if PROJECT_ID and PROJECT_TOKEN are set ───
if [ -n "$PROJECT_ID" ] && [ -n "$PROJECT_TOKEN" ]; then
  APP_URL="${NEXT_PUBLIC_APP_URL:-https://capable.ai}"
  echo ">>> [OpenClaw] Downloading pack for project $PROJECT_ID..."

  PACK_URL=$(curl -sf -X POST "${APP_URL}/api/packs/${PROJECT_ID}/download-url" \
    -H "Content-Type: application/json" \
    -d "{\"version\":${PACK_VERSION:-1},\"projectToken\":\"${PROJECT_TOKEN}\"}" | jq -r '.url')

  if [ -n "$PACK_URL" ] && [ "$PACK_URL" != "null" ]; then
    curl -fsSL "${PACK_URL}&format=json" -o /tmp/pack.json

    cd "$WORKSPACE_DIR"
    for filename in $(jq -r '.files | keys[]' /tmp/pack.json); do
      mkdir -p "$(dirname "$filename")"
      jq -r --arg f "$filename" '.files[$f]' /tmp/pack.json > "$filename"
    done
    rm /tmp/pack.json

    # Copy activity files
    if [ -d "$WORKSPACE_DIR/activity" ]; then
      cp -r "$WORKSPACE_DIR/activity/"* /data/activity/ 2>/dev/null || true
    fi

    mkdir -p "$WORKSPACE_DIR/memory"
    rm -f "$WORKSPACE_DIR/configPatch.json"

    echo ">>> [OpenClaw] Pack downloaded successfully."
  else
    echo ">>> [OpenClaw] WARNING: Could not get pack download URL."
  fi
else
  echo ">>> [OpenClaw] No PROJECT_ID/PROJECT_TOKEN — skipping pack download."
fi

# ─── 2. Configure OpenClaw ───
echo ">>> [OpenClaw] Configuring gateway..."

# Generate gateway token if not provided
GATEWAY_TOKEN="${GATEWAY_TOKEN:-$(openssl rand -hex 32)}"

# Write/update config
if [ ! -f "$CONFIG_FILE" ]; then
  echo '{}' > "$CONFIG_FILE"
fi

# Merge gateway config using jq
cat "$CONFIG_FILE" | jq --arg token "$GATEWAY_TOKEN" '. + {
  gateway: (.gateway // {} | . + {
    mode: "local",
    bind: "lan",
    auth: { mode: "token", token: $token },
    controlUi: { basePath: "/chat", allowInsecureAuth: true },
    trustedProxies: ["127.0.0.1", "::1", "172.16.0.0/12", "10.0.0.0/8"]
  }),
  browser: { executablePath: "/usr/bin/chromium" }
}' > "${CONFIG_FILE}.tmp" && mv "${CONFIG_FILE}.tmp" "$CONFIG_FILE"

chmod 600 "$CONFIG_FILE"

# Save gateway token for other containers to reference
echo "$GATEWAY_TOKEN" > /root/.openclaw/gateway-token
chmod 600 /root/.openclaw/gateway-token

echo ">>> [OpenClaw] Starting gateway on port ${OPENCLAW_GATEWAY_PORT:-18789}..."
exec $OPENCLAW_BIN gateway --port "${OPENCLAW_GATEWAY_PORT:-18789}" --verbose
