# =========================================
# Capable.ai — OpenClaw Container
# AI agent runtime with browser automation
# =========================================

FROM node:22-bookworm-slim

# Install Chromium and utilities
RUN apt-get update && apt-get install -y --no-install-recommends \
    chromium \
    curl \
    git \
    jq \
    openssl \
    && rm -rf /var/lib/apt/lists/*

# Set Chromium path for OpenClaw's browser tool
ENV CHROME_PATH=/usr/bin/chromium
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium
ENV PUPPETEER_CHROMIUM_REVISION=skip

# Install OpenClaw globally
ARG OPENCLAW_VERSION=2026.2.6-3
RUN npm install -g openclaw@${OPENCLAW_VERSION}

# Create workspace and config directories
RUN mkdir -p /root/.openclaw/workspace /data/activity

# Copy entrypoint script
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

# Gateway port
ENV OPENCLAW_GATEWAY_PORT=18789
EXPOSE 18789

ENTRYPOINT ["/entrypoint.sh"]
