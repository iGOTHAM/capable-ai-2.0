# =========================================
# Capable.ai Dashboard — Docker Build
# Build from monorepo root:
#   docker build -f apps/dashboard/Dockerfile -t capable-ai/dashboard:latest .
# =========================================

FROM node:20-alpine AS base

# ---- Dependencies ----
FROM base AS deps
RUN apk add --no-cache libc6-compat
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

# Create data directory
RUN mkdir -p /data/activity && chown nextjs:nodejs /data/activity

USER nextjs

EXPOSE 3100

CMD ["node", "apps/dashboard/server.js"]
