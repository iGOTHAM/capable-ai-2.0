# =========================================
# Capable.ai Dashboard — Docker Build
# Build from monorepo root:
#   docker build -f apps/dashboard/Dockerfile -t capable-ai/dashboard:latest .
# =========================================

FROM node:20-alpine AS base

# ---- Dependencies ----
FROM base AS deps
RUN apk add --no-cache libc6-compat python3 make g++
WORKDIR /app

# Install pnpm
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

# Copy workspace config
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./

# Copy package.json files for all workspace packages the dashboard needs
COPY apps/dashboard/package.json ./apps/dashboard/
COPY packages/shared/package.json ./packages/shared/

# Install dependencies (frozen lockfile for reproducibility)
RUN pnpm install --frozen-lockfile --filter=@capable-ai/dashboard...

# ---- Builder ----
FROM base AS builder
WORKDIR /app

RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

# Copy deps from previous stage
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/dashboard/node_modules ./apps/dashboard/node_modules
COPY --from=deps /app/packages/shared/node_modules ./packages/shared/node_modules

# Copy source code
COPY packages/shared/ ./packages/shared/
COPY apps/dashboard/ ./apps/dashboard/

# Copy workspace config (needed for build resolution)
COPY pnpm-workspace.yaml package.json turbo.json ./

# Build the dashboard (STANDALONE=1 enables output: "standalone" in next.config.ts)
ENV STANDALONE=1
WORKDIR /app/apps/dashboard
RUN npx next build

# ---- Runner ----
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0
ENV PORT=3100

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy standalone output
COPY --from=builder /app/apps/dashboard/.next/standalone ./
COPY --from=builder /app/apps/dashboard/.next/static ./apps/dashboard/.next/static

# Copy node-pty native binding + ws for the terminal sidecar server
COPY --from=deps /app/node_modules/node-pty ./node_modules/node-pty
COPY --from=deps /app/node_modules/ws ./node_modules/ws

# Create data directory
RUN mkdir -p /data/activity && chown nextjs:nodejs /data/activity

# Install runtime dependencies
# - curl/unzip: bootstrap script
# - docker-cli: needed for `docker exec` to reach OpenClaw container
# - libc6-compat: runtime dependency for node-pty native addon
RUN apk add --no-cache curl unzip docker-cli libc6-compat

# Copy scripts
COPY apps/dashboard/scripts/bootstrap-pack.mjs ./scripts/bootstrap-pack.mjs
COPY apps/dashboard/scripts/ws-terminal-server.mjs ./scripts/ws-terminal-server.mjs

# Create workspace directory
RUN mkdir -p /workspace && chown nextjs:nodejs /workspace

USER nextjs

EXPOSE 3100
EXPOSE 3101

# Start both the terminal WebSocket server (background) and Next.js (foreground)
CMD ["sh", "-c", "node scripts/ws-terminal-server.mjs & node scripts/bootstrap-pack.mjs && node apps/dashboard/server.js"]
