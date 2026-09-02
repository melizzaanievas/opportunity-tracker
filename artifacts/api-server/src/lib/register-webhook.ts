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
const TELEGRAM_WEBHOOK_MAX_ATTEMPTS = 3;
const TELEGRAM_WEBHOOK_RETRY_DELAY_MS = 250;

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

function isRetryableTelegramStatus(status: number): boolean {
  return (
    status === 408 ||
    status === 425 ||
    status === 429 ||
    (status >= 500 && status <= 599)
  );
}

function waitForRetry(): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, TELEGRAM_WEBHOOK_RETRY_DELAY_MS);
  });
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

  let lastFailure: { description: string; retryable: boolean } | null = null;

  for (let attempt = 1; attempt <= TELEGRAM_WEBHOOK_MAX_ATTEMPTS; attempt += 1) {
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
        },
      );
      const data = (await res.json()) as {
        ok: boolean;
        description?: string;
        result?: boolean;
      };

      if (data.ok && res.ok) {
        webhookReadiness = {
          status: "successful",
          webhookUrl,
          description: null,
        };
        logger.info({ webhookUrl }, "Telegram webhook registered");
        return;
      }

      const description =
        data.description?.trim() ||
        "Telegram did not provide a rejection description";
      lastFailure = {
        description,
        retryable: isRetryableTelegramStatus(res.status),
      };
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      lastFailure = { description: reason, retryable: true };
    }

    if (!lastFailure.retryable || attempt === TELEGRAM_WEBHOOK_MAX_ATTEMPTS) {
      break;
    }

    logger.warn(
      {
        attempt,
        maxAttempts: TELEGRAM_WEBHOOK_MAX_ATTEMPTS,
        webhookUrl,
      },
      "Temporary Telegram webhook registration failure; retrying",
    );
    await waitForRetry();
  }

  const safeDescription = redactSensitiveValues(
    lastFailure?.description ||
      "Telegram webhook registration failed without a description",
    sensitiveValues,
  );
  webhookReadiness = {
    status: "failed",
    webhookUrl,
    description: safeDescription,
  };
  throw createRegistrationError(webhookUrl, safeDescription, []);
}
