# Opportunity Tracker

Opportunity Tracker is a personal web dashboard and Telegram bot built to capture jobs, grants, and hackathons on mobile and manage them on desktop.

## Core Features

- Capture opportunities from a mobile device through a Telegram bot.
- Extract useful link details automatically, including titles, summaries, deadlines, and action steps.
- Generate a one-click Google Calendar invite for each opportunity.
- Send an automated morning summary to Telegram at 8:00 AM through the built-in scheduler.
- Review and manage opportunities on desktop with a clean, dark-gothic glassmorphism dashboard.

## Prerequisites

You need a Telegram bot, a private Telegram chat ID, and a deployment or local environment that can run the web dashboard and API server.

The project uses SQLite for local persistence. The database is created automatically when the API server starts and is ignored by Git.

## Environment Variables

Add the following values to `.env` for local development or to Replit Secrets for a Replit deployment:

| Variable | Description |
| --- | --- |
| `APP_PASSWORD` | Password protection for the web dashboard. |
| `TELEGRAM_BOT_TOKEN` | Bot token from [@BotFather](https://t.me/BotFather). |
| `TELEGRAM_CHAT_ID` | Your private Telegram Chat ID. |

Copy `.env.example` to `.env` as a starting point:

```bash
cp .env.example .env
```

Keep `.env` private. Do not commit it or any SQLite database files to Git.

## Quickstart

### Create a copy on GitHub

Click **Use this template** on GitHub to create a copy of the repository in your own account.

### Import the repository into Replit

Create a new Replit app from your GitHub repository. Replit will detect the project configuration and workspace packages.

### Configure secrets

Open the Replit Secrets panel and add `APP_PASSWORD`, `TELEGRAM_BOT_TOKEN`, and `TELEGRAM_CHAT_ID`.

For local development, add the same values to `.env`.

### Run the application

In Replit, click **Start** or use the configured Replit start command.

For a local workspace, start the API server and frontend with:

```bash
pnpm --filter @workspace/api-server run dev
pnpm --filter @workspace/opportunity-tracker run dev
```

If your environment provides an `npm run dev` wrapper, you can use that command instead.

The API server runs on port `8080` and the frontend runs on port `22507` in the standard workspace configuration.

### Configure the daily summary

The API server includes a built-in daily summary schedule for 8:00 AM. You can also use [cron-job.org](https://cron-job.org/) to call the public summary endpoint at a time that suits your schedule.

Create a daily cron job for:

```text
https://YOUR-APP-DOMAIN/cron-daily-summary
```

Set the cron job to run at 9:00 AM if you want external daily 9:00 AM pings. Replace `YOUR-APP-DOMAIN` with the public URL for your deployment.

## Telegram Setup

- Open [@BotFather](https://t.me/BotFather) in Telegram.
- Create a bot and copy its token into `TELEGRAM_BOT_TOKEN`.
- Open the bot from your private Telegram account and send it a message.
- Find your private chat ID and add it as `TELEGRAM_CHAT_ID`.
- Start the API server. The bot webhook is registered during server startup.
- Send an opportunity URL to the bot to capture it.

Only messages from the configured `TELEGRAM_CHAT_ID` are accepted by the webhook.

## Project Structure

| Directory | Purpose |
| --- | --- |
| `artifacts/opportunity-tracker` | React and Vite desktop dashboard. |
| `artifacts/api-server` | Express API, SQLite database, scraper, Telegram integration, and calendar support. |
| `lib/api-spec` | OpenAPI source specification. |
| `lib/api-client-react` | Generated React Query client. |
| `lib/api-zod` | Generated Zod schemas. |
| `lib/db` | Shared database package and schema definitions. |

## Development Commands

```bash
pnpm run typecheck
pnpm run build
pnpm run audit:deps
```

After changing the OpenAPI specification, regenerate the API clients and schemas:

```bash
pnpm --filter @workspace/api-spec run codegen
```

## License

Add the license that matches how you want others to use and distribute this project.