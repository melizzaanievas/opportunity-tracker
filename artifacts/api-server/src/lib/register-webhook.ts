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

function redactSensitiveValues(message: string, values: string[]): string {
  return values.reduce(
    (redacted, value) => (value ? redacted.replaceAll(value, "[REDACTED]") : redacted),
    message,
  );
}

function createRegistrationError(
  webhookUrl: string,
  reason: string,
  sensitiveValues: string[],
): Error {
  const safeReason = redactSensitiveValues(reason, sensitiveValues);
  return new Error(`Telegram webhook registration failed for ${webhookUrl}: ${safeReason}`);
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
  const sensitiveValues = [token, secretToken];

  let data: { ok: boolean; description?: string; result?: boolean };
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

    data = (await res.json()) as { ok: boolean; description?: string; result?: boolean };
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    throw createRegistrationError(webhookUrl, reason, sensitiveValues);
  }

  if (!data.ok) {
    throw createRegistrationError(
      webhookUrl,
      data.description?.trim() || "Telegram did not provide a rejection description",
      sensitiveValues,
    );
  }

  logger.info({ webhookUrl }, "Telegram webhook registered");
}
