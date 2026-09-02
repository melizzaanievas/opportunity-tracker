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

const TELEGRAM_WEBHOOK_PATH = "/api/integrations/telegram-webhook";

export type TelegramWebhookRegistrationStatus =
  "pending" | "successful" | "failed";

export interface TelegramWebhookReadiness {
  status: TelegramWebhookRegistrationStatus;
  webhookUrl: string | null;
  description: string | null;
}

let webhookReadiness: TelegramWebhookReadiness = {
  status: "pending",
  webhookUrl: null,
  description: null,
};

function getConfiguredWebhookUrl(): string | null {
  const base = getPublicBaseUrl();
  return base ? `${base}${TELEGRAM_WEBHOOK_PATH}` : null;
}

export function getTelegramWebhookReadiness(): TelegramWebhookReadiness {
  if (webhookReadiness.status === "pending" && !webhookReadiness.webhookUrl) {
    return {
      ...webhookReadiness,
      webhookUrl: getConfiguredWebhookUrl(),
    };
  }

  return { ...webhookReadiness };
}

function redactSensitiveValues(message: string, values: string[]): string {
  return values.reduce(
    (redacted, value) =>
      value ? redacted.replaceAll(value, "[REDACTED]") : redacted,
    message,
  );
}

function createRegistrationError(
  webhookUrl: string,
  reason: string,
  sensitiveValues: string[],
): Error {
  const safeReason = redactSensitiveValues(reason, sensitiveValues);
  return new Error(
    `Telegram webhook registration failed for ${webhookUrl}: ${safeReason}`,
  );
}

export async function registerTelegramWebhook(): Promise<void> {
  webhookReadiness = {
    status: "pending",
    webhookUrl: getConfiguredWebhookUrl(),
    description: null,
  };

  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    logger.warn("TELEGRAM_BOT_TOKEN not set — skipping webhook registration");
    return;
  }

  const secretToken = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (!secretToken) {
    logger.warn(
      "TELEGRAM_WEBHOOK_SECRET not set — skipping webhook registration",
    );
    return;
  }

  const base = getPublicBaseUrl();
  if (!base) {
    logger.warn(
      "Cannot determine public URL (REPLIT_DOMAINS/REPLIT_DEV_DOMAIN not set) — skipping webhook registration",
    );
    return;
  }

  const webhookUrl = `${base}${TELEGRAM_WEBHOOK_PATH}`;
  const sensitiveValues = [token, secretToken];

  let data: { ok: boolean; description?: string; result?: boolean };
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/setWebhook`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        url: webhookUrl,
        secret_token: secretToken,
        allowed_updates: ["message", "callback_query"],
        drop_pending_updates: false,
      }),
    });

    data = (await res.json()) as {
      ok: boolean;
      description?: string;
      result?: boolean;
    };
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    const safeReason = redactSensitiveValues(reason, sensitiveValues);
    webhookReadiness = {
      status: "failed",
      webhookUrl,
      description: safeReason,
    };
    throw createRegistrationError(webhookUrl, safeReason, []);
  }

  if (!data.ok) {
    const description =
      data.description?.trim() ||
      "Telegram did not provide a rejection description";
    const safeDescription = redactSensitiveValues(description, sensitiveValues);
    webhookReadiness = {
      status: "failed",
      webhookUrl,
      description: safeDescription,
    };
    throw createRegistrationError(webhookUrl, safeDescription, []);
  }

  webhookReadiness = {
    status: "successful",
    webhookUrl,
    description: null,
  };
  logger.info({ webhookUrl }, "Telegram webhook registered");
}
