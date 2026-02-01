# Capable.ai

Capable.ai generates and deploys AI assistant packs to your own infrastructure. Pay once, deploy to your DigitalOcean droplet, own your data.

## Prerequisites

- Node.js >= 20
- pnpm 9.x
- Docker (for local Postgres)

## Quick Start

```bash
# Install dependencies
pnpm install

# Start Postgres
pnpm docker:up

# Run database migrations
pnpm db:migrate:dev

# Generate Prisma client
pnpm db:generate

# Start dev servers (web on :3000, dashboard on :3100)
pnpm dev
```

## Project Structure

```
apps/web          — Capable.ai SaaS web app (Next.js 15)
apps/dashboard    — VPS-side activity dashboard (Next.js 15 standalone)
packages/shared   — Shared types, event schema, utilities
prisma/           — Database schema and migrations
docs/             — PRD and pack templates
scripts/          — Cloud-init generator, pack builder
```

## Environment Variables

Copy `.env.example` to `.env` and fill in your values:

```bash
cp .env.example .env
```

See `.env.example` for all required variables.

## Commands

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start all dev servers |
| `pnpm dev:web` | Start web app only (port 3000) |
| `pnpm dev:dashboard` | Start dashboard only (port 3100) |
| `pnpm build` | Build all apps |
| `pnpm typecheck` | Type-check everything |
| `pnpm lint` | Lint everything |
| `pnpm db:migrate:dev` | Run Prisma migrations |
| `pnpm db:generate` | Generate Prisma client |
| `pnpm docker:up` | Start Postgres container |
| `pnpm docker:down` | Stop Postgres container |
