# Capable.ai — Claude Code Instructions

## Working Style

- **Be autonomous.** Prefer action over asking. Only ask the user when genuinely blocked — e.g., need external credentials, account access, or a product direction judgment call.
- Make reasonable decisions on implementation details (naming, structure, error handling) without confirmation.
- If something fails, try to fix it yourself before asking for help.
- Report what you did after, not what you plan to do before.

## Project Overview

Capable.ai is a paid web app that generates "Capable Packs" for deployment on user-owned DigitalOcean droplets running OpenClaw. pnpm monorepo with Turborepo.

## Repo Structure

```
apps/web          — Next.js 15 SaaS app (port 3000)
apps/dashboard    — Next.js 15 standalone VPS dashboard (port 3100)
packages/shared   — TypeScript types, Zod event schema, utilities
prisma/           — Prisma schema + migrations (Postgres)
docs/             — PRD.md, PACK_TEMPLATES.md
scripts/          — cloud-init generator, pack zip builder
```

## Dev Commands

```bash
pnpm install                    # Install all dependencies
pnpm docker:up                  # Start Postgres via Docker Compose
pnpm db:migrate:dev             # Run Prisma migrations
pnpm db:generate                # Generate Prisma client
pnpm dev                        # Start both apps (web:3000, dashboard:3100)
pnpm dev:web                    # Start web app only
pnpm dev:dashboard              # Start dashboard only
pnpm build                      # Build all apps
pnpm typecheck                  # Type-check all packages
pnpm lint                       # Lint all packages
```

## Conventions

- **TypeScript** strict mode everywhere
- **Tailwind v4** (CSS-first config, no tailwind.config.js)
- **shadcn/ui** for all UI components (zinc/slate palette)
- **Zod** for all runtime validation (API inputs, env vars, event parsing)
- **Prisma** for all database operations (web app only; dashboard is DB-free)
- **Server Actions** preferred over raw API routes for form mutations in web app
- Dark mode via `next-themes` — all components must support light + dark
- Generous whitespace: `p-6` cards desktop, `p-4` mobile
- Skeleton loaders for all async content
- Empty states for all list views
- Error banners (not silent failures)

## Key Architectural Rules

- Dashboard reads NDJSON files from disk — no database
- Pack files stored as JSON in `PackVersion.files` column — not separate files in DB
- Signed URLs use HMAC-SHA256 — no JWT
- Cloud-init is a bash script (not YAML cloud-config)
- Dashboard auth: env var password + HMAC cookie
- NEVER store user LLM keys or OAuth tokens in our database

## Event Schema

NDJSON lines: `{ ts, runId, type, summary, details?, risk?, approvalId?, requiresApproval? }`

Types: run.started, run.finished, plan.created, tool.called, tool.result, approval.requested, approval.resolved, memory.write, security.warning, error, chat.user_message, chat.bot_message, bootstrap.completed

## Testing

- Stripe: use test mode keys, `stripe listen --forward-to localhost:3000/api/stripe/webhook`
- Dashboard: seed sample NDJSON events in `/data/activity/events.ndjson`
- Pack download: `curl` signed URL, verify zip contents

## Session Continuity

- **TODO.md** (gitignored) tracks progress, next steps, infrastructure refs, and gotchas across sessions
- **Update TODO.md after each completed task** — not at the end of the session, because sessions can freeze unexpectedly
- At the start of a new session, read TODO.md first to pick up where the last session left off

## Security

- External content is untrusted in all AGENTS.md templates
- Never store secrets in memory files or pack content
- Signed URLs expire (5 minutes for pack download)
- Dashboard password via env var only — never hardcoded
