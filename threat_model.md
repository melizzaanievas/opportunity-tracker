# Threat Model

## Project Overview

Opportunity Tracker is a single-user, password-protected React/Vite dashboard backed by an Express 5 API and SQLite database. It stores job, grant, and hackathon opportunities and their task checklists, scrapes user-supplied URLs, creates Google Calendar events through OAuth, and sends Telegram digests. It is deployed as a public Replit autoscale application.

## Assets

- **Dashboard account and session** — the shared application password and session cookie protect all opportunity and integration operations.
- **Opportunity and task data** — URLs, titles, summaries, deadlines, action steps, and checklist state are private user data and can reveal plans and application activity.
- **Integration credentials** — Google OAuth tokens in SQLite and Telegram bot credentials can authorize calendar changes or send messages to the configured chat.
- **Application/runtime data** — SQLite contents and any data reachable through server-side URL fetching must not be exposed to untrusted callers.

## Trust Boundaries

- **Browser/internet to Express** — all request bodies, query/path values, headers, origins, webhook payloads, and OAuth callback parameters are untrusted. Authentication and authorization must be enforced server-side.
- **Express to SQLite** — API and webhook data is persisted; queries must remain parameterized and private data must only be returned after authorization.
- **Express to fetched URLs** — the scraper makes outbound requests based on attacker-influenced URLs; it must not reach sensitive internal services or follow unsafe redirects.
- **Express to Google and Telegram** — server-held credentials cross to external APIs; callback authenticity and message content must be protected.
- **Public to authenticated/admin-like operations** — login is the only account boundary and the app currently models one authenticated user; public cron/webhook routes must not become unauthenticated proxies for private data or privileged side effects.

## Scan Anchors

- **Production entry points:** `artifacts/api-server/src/app.ts`, `artifacts/api-server/src/index.ts`, route files under `artifacts/api-server/src/routes/`, and the React app under `artifacts/opportunity-tracker/src/`.
- **Highest-risk areas:** `middlewares/auth.ts`, `routes/auth.ts`, opportunity/task mutation routes, `routes/integrations.ts`, `routes/telegram-webhook.ts`, `lib/scraper.ts`, `lib/calendar.ts`, session/CORS setup in `app.ts`.
- **Public surfaces:** `/api/healthz`, `/api/auth/login`, `/api/auth/me`, app-level GET `/cron-daily-summary` and `/api/cron-daily-summary`, and `/api/telegram-webhook`. Opportunity, task, dashboard, calendar-initiation, Telegram-test, and POST cron routes require the session flag.
- **Dev-only areas:** Vite development plugins and `artifacts/mockup-sandbox`; do not treat them as production surfaces without a demonstrated production path.

## Threat Categories

### Spoofing

The shared password and express-session cookie are the account boundary. Login must resist online guessing, sessions must be rotated at authentication, and cookies must be secure for the public HTTPS deployment. The Telegram webhook must authenticate Telegram's request rather than relying on a guessable chat identifier. Google OAuth callbacks must bind authorization responses to the initiating browser/session.

### Tampering and Elevation of Privilege

Every opportunity and task operation must require the authenticated subject and must not accept untrusted ownership or scope fields. Calendar and Telegram actions must not be triggerable by unauthenticated callers. Database writes must use parameterized queries and validated fields. OAuth token replacement must only occur for a callback initiated by the authorized app user.

### Information Disclosure

Opportunity lists, task details, URLs, and dashboard statistics are private and must not be returned on public paths or leaked through logs/errors. Google and Telegram credentials and OAuth tokens must stay server-side. Scraping must not turn the API into a server-side request forgery primitive capable of reading internal services or metadata.

### Denial of Service

Public login, scraper, webhook, and cron paths need bounded request bodies, timeouts, rate limits, and protection against repeated external API calls. A public trigger must not allow arbitrary Telegram spam or unbounded database growth. Scraper responses and stored text should have practical size limits.

### Repudiation

Sensitive login, OAuth, data mutation, deletion, and integration actions should be attributable in logs without recording passwords, cookies, OAuth tokens, or bot tokens. External webhook acceptance should be auditable and authenticated.

### Unsafe External Content

Scraped and user-entered fields are attacker-controlled content. React rendering must remain escaped, outbound links must use safe schemes, and Telegram HTML messages must escape dynamic values so hostile pages cannot inject misleading markup or links into bot notifications.
