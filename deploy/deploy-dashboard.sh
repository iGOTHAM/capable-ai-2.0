#!/bin/bash
# =========================================
# Capable.ai — Dashboard Deploy Script
# =========================================
# Downloads latest dashboard build from GitHub Releases
# and restarts the systemd service.
#
# Usage:
#   GH_TOKEN=ghp_xxx ./deploy-dashboard.sh <asset-id>
#
# Get the asset ID:
#   curl -s -H "Authorization: token $GH_TOKEN" \
#     https://api.github.com/repos/iGOTHAM/capable-ai-2.0/releases/tags/dashboard-latest \
#     | jq '.assets[0].id'
# =========================================
set -euo pipefail

INSTALL_DIR="/opt/capable/dashboard"
BACKUP_DIR="/opt/capable/dashboard.backup"

# ─── 1. Parse arguments ───
ASSET_ID="${1:-}"
if [ -z "$ASSET_ID" ]; then
  echo "Usage: $0 <github-asset-id>"
  exit 1
fi

GH_TOKEN="${GH_TOKEN:-}"
if [ -z "$GH_TOKEN" ]; then
  echo "ERROR: Set GH_TOKEN environment variable"
  exit 1
fi

ASSET_URL="https://api.github.com/repos/iGOTHAM/capable-ai-2.0/releases/assets/${ASSET_ID}"

# ─── 2. Download tarball ───
echo ">>> Downloading dashboard tarball (asset $ASSET_ID)..."
curl -fSL \
  -H "Authorization: token $GH_TOKEN" \
  -H "Accept: application/octet-stream" \
  "$ASSET_URL" -o /tmp/dash.tar.gz

echo "    $(du -h /tmp/dash.tar.gz | cut -f1) downloaded"

# ─── 3. Verify tarball ───
echo ">>> Verifying tarball..."
tar -tzf /tmp/dash.tar.gz > /dev/null

# ─── 4. Backup current installation ───
echo ">>> Creating backup..."
rm -rf "$BACKUP_DIR"
if [ -d "$INSTALL_DIR" ]; then
  cp -a "$INSTALL_DIR" "$BACKUP_DIR"
fi

# ─── 5. Extract new dashboard ───
echo ">>> Extracting..."
rm -rf "$INSTALL_DIR"
mkdir -p "$INSTALL_DIR"
tar -xzf /tmp/dash.tar.gz -C "$INSTALL_DIR"

# ─── 6. Install native modules ───
echo ">>> Installing node-pty and ws..."
cd "$INSTALL_DIR"
npm install --no-save node-pty ws 2>&1 | tail -3

# ─── 7. Restart service ───
echo ">>> Restarting dashboard..."
systemctl restart capable-dashboard

# ─── 8. Verify ───
sleep 3
if systemctl is-active --quiet capable-dashboard; then
  echo ">>> Dashboard is running!"
  journalctl -u capable-dashboard --no-pager -n 5
else
  echo ">>> WARNING: Dashboard failed to start. Rolling back..."
  rm -rf "$INSTALL_DIR"
  if [ -d "$BACKUP_DIR" ]; then
    mv "$BACKUP_DIR" "$INSTALL_DIR"
    systemctl restart capable-dashboard
    echo ">>> Rollback complete."
  else
    echo ">>> No backup to roll back to!"
  fi
  exit 1
fi

# ─── 9. Cleanup ───
rm -f /tmp/dash.tar.gz
rm -rf "$BACKUP_DIR"
echo ">>> Deploy complete!"
