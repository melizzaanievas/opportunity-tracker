# Opportunity Tracker

A private, password-protected full-stack web dashboard for tracking jobs, grants, and hackathon opportunities. Paste a URL to auto-scrape deadline/summary/action steps, manage sub-task checklists with progress bars, add deadlines to Google Calendar, and receive automated Telegram daily digests.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 8080)
- `pnpm --filter @workspace/opportunity-tracker run dev` — run the frontend (port 22507)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm --filter @workspace/api-server run build` — build the API server
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: React 19 + Vite, Tailwind CSS v4, shadcn/ui, TanStack Query, wouter
- API: Express 5 (artifacts/api-server)
- DB: SQLite (better-sqlite3 + drizzle-orm) — stored at `artifacts/api-server/data/app.db`
- Session: express-session (in-memory, 7-day cookie)
- Scraping: cheerio + built-in fetch
- Cron: node-cron (daily at 8:00 AM)
- Integrations: Google Calendar (googleapis OAuth2), Telegram Bot API

## Required Secrets

| Secret | Purpose |
|---|---|
| `APP_PASSWORD` | Password to log in to the app |
| `SESSION_SECRET` | Express session signing key |
| `GOOGLE_CLIENT_ID` | Google OAuth 2.0 app client ID |
| `GOOGLE_CLIENT_SECRET` | Google OAuth 2.0 app client secret |
| `TELEGRAM_BOT_TOKEN` | Telegram bot token from @BotFather |
| `TELEGRAM_CHAT_ID` | Chat/channel ID for Telegram digests |

## Google Calendar Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create an OAuth 2.0 Client ID (Web application)
3. Add the authorized redirect URI: `https://<your-replit-domain>/api/integrations/google/callback`
4. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET secrets

## Where Things Live

- `lib/api-spec/openapi.yaml` — API contract (source of truth)
- `lib/api-client-react/src/generated/` — Generated React Query hooks
- `lib/api-zod/src/generated/` — Generated Zod validation schemas
- `artifacts/api-server/src/db/` — SQLite schema, connection, migrations
- `artifacts/api-server/src/routes/` — Express route handlers
- `artifacts/api-server/src/lib/` — scraper, telegram, calendar, cron
- `artifacts/opportunity-tracker/src/` — React frontend

## Architecture Decisions

- SQLite chosen over PostgreSQL for simplicity and portability — single-user private app with no need for concurrent writes
- Session auth (express-session) over JWT — simpler for a single-user private app; password is compared directly to APP_PASSWORD env var
- Scraper uses cheerio + built-in fetch with a 15s timeout; gracefully falls back to manual entry on failure
- Google OAuth tokens stored in the SQLite `settings` table — persisted across server restarts
- Cron job runs inside the Express process at 8 AM; the `/api/cron-daily-summary` endpoint allows external triggering (protected by auth session)

## User Preferences

_Populate as you build._

## Database Commit Protection

A pre-commit Git hook (`.githooks/pre-commit`) blocks any commit that contains staged `*.db`, `*.db-shm`, `*.db-wal`, `*.sqlite`, or `*.sqlite3` files. The hook exits non-zero and prints which files are staged along with the `git restore --staged` commands needed to unstage them.

The hook path is wired in via the workspace `prepare` script in `package.json`:

```
"prepare": "git config core.hooksPath .githooks"
```

This means `pnpm install` (or `pnpm run prepare`) automatically activates the hook for any fresh clone. The live SQLite database lives at `artifacts/api-server/data/app.db` and is covered by `.gitignore`, so normal workflows will never accidentally stage it — but the hook is a second line of defence.

## Gotchas

- After any OpenAPI spec change, run `pnpm --filter @workspace/api-spec run codegen` before using updated types
- better-sqlite3 is a native module — it uses prebuilt binaries for linux-x64 (no compilation needed on Replit)
- Google Calendar first use requires OAuth flow; click "Add to Google Calendar" → authorize in new tab → retry
- The `data/` directory (SQLite DB) is created automatically on first start inside `artifacts/api-server/`

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
