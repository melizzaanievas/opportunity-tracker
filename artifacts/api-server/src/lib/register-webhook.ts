import { logger } from "./logger";

/** Returns the best public base URL for this Replit app. */
function getPublicBaseUrl(): string | null {
  const domains = process.env.REPLIT_DOMAINS;
  if (domains) {
    const first = domains.split(",")[0].trim();
    return `https://${first}`;
  }
  const dev = process.env.REPLIT_DEV_DOMAIN;
  if (dev) {
    return `https://${dev}`;
  }
  return null;
}

export async function registerTelegramWebhook(): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    logger.warn("TELEGRAM_BOT_TOKEN not set — skipping webhook registration");
    return;
  }

  const secretToken = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (!secretToken) {
    logger.warn("TELEGRAM_WEBHOOK_SECRET not set — skipping webhook registration");
    return;
  }

  const base = getPublicBaseUrl();
  if (!base) {
    logger.warn("Cannot determine public URL (REPLIT_DOMAINS/REPLIT_DEV_DOMAIN not set) — skipping webhook registration");
    return;
  }

  const webhookUrl = `${base}/api/integrations/telegram-webhook`;

  try {
    const res = await fetch(
      `https://api.telegram.org/bot${token}/setWebhook`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: webhookUrl,
          secret_token: secretToken,
          allowed_updates: ["message", "callback_query"],
          drop_pending_updates: false,
        }),
      }
    );

    const data = (await res.json()) as { ok: boolean; description?: string; result?: boolean };
    if (data.ok) {
      logger.info({ webhookUrl }, "Telegram webhook registered");
    } else {
      logger.error({ description: data.description, webhookUrl }, "Failed to register Telegram webhook");
    }
  } catch (err) {
    logger.error({ err }, "Error calling Telegram setWebhook");
  }
}
