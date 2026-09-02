import { logger } from "./logger";
import { getTelegramWebhookSecret } from "./telegram";

/** Returns the best public base URL for this Replit app. */
function getPublicBaseUrl(requestHost?: string): string | null {
  const host = requestHost?.trim();
  if (
    host &&
    !/^(localhost|127(?:\.\d{1,3}){3}|0\.0\.0\.0|\[?::1\]?)(?::\d+)?$/i.test(
      host,
    )
  ) {
    return `https://${host}`;
  }

  // Replit's dev domain is the current public host for development and
  // staging. Prefer it over a stale custom-domain value in those environments.
  if (process.env.NODE_ENV !== "production") {
    const dev = process.env.REPLIT_DEV_DOMAIN?.trim();
    if (dev) {
      return `https://${dev}`;
    }
  }

  const domains = process.env.REPLIT_DOMAINS;
  if (domains) {
    const first = domains.split(",")[0].trim();
    if (first) return `https://${first}`;
  }

  const dev = process.env.REPLIT_DEV_DOMAIN?.trim();
  return dev ? `https://${dev}` : null;
}

export const TELEGRAM_WEBHOOK_PATH = "/api/telegram/webhook";
const TELEGRAM_WEBHOOK_MAX_ATTEMPTS = 3;
const TELEGRAM_WEBHOOK_RETRY_DELAY_MS = 250;
const TELEGRAM_WEBHOOK_MAX_RETRY_DELAY_MS = 5_000;

export type TelegramWebhookRegistrationStatus =
  "pending" | "successful" | "failed";

export type TelegramWebhookLiveStatus =
  "unknown" | "matching" | "out_of_band" | "stale" | "unavailable";

export interface TelegramWebhookReadiness {
  status: TelegramWebhookRegistrationStatus;
  webhookUrl: string | null;
  description: string | null;
  liveStatus?: TelegramWebhookLiveStatus;
  liveWebhookUrl?: string | null;
  liveDescription?: string | null;
  secretTokenConfigured?: boolean;
}

let webhookReadiness: TelegramWebhookReadiness = {
  status: "pending",
  webhookUrl: null,
  description: null,
};

function getConfiguredWebhookUrl(requestHost?: string): string | null {
  const base = getPublicBaseUrl(requestHost);
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

function redactSensitiveValues(
  message: string,
  values: Array<string | undefined>,
): string {
  let redacted = message;
  for (const value of values) {
    if (value) {
      redacted = redacted.replaceAll(value, "[REDACTED]");
    }
  }
  return redacted;
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

function getTelegramRetryDelayMs(
  status: number,
  parameters: unknown,
): number {
  if (
    status !== 429 ||
    typeof parameters !== "object" ||
    parameters === null ||
    !("retry_after" in parameters) ||
    typeof parameters.retry_after !== "number" ||
    !Number.isFinite(parameters.retry_after) ||
    parameters.retry_after <= 0
  ) {
    return TELEGRAM_WEBHOOK_RETRY_DELAY_MS;
  }

  return Math.min(
    parameters.retry_after * 1_000,
    TELEGRAM_WEBHOOK_MAX_RETRY_DELAY_MS,
  );
}

function waitForRetry(delayMs: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, delayMs);
  });
}

const EXPECTED_ALLOWED_UPDATES = ["message", "callback_query"];

interface TelegramWebhookInfo {
  url?: unknown;
  allowed_updates?: unknown;
  last_error_message?: unknown;
  last_error_date?: unknown;
}

interface TelegramWebhookInfoResponse {
  ok: boolean;
  description?: unknown;
  result?: TelegramWebhookInfo;
}

let liveWebhookCheck: Promise<void> | null = null;

function getSafeTelegramDescription(
  description: unknown,
  sensitiveValues: Array<string | undefined>,
  fallback: string,
): string {
  const rawDescription =
    typeof description === "string" && description.trim()
      ? description.trim()
      : fallback;
  return redactSensitiveValues(rawDescription, sensitiveValues);
}

function updateLiveWebhookReadiness(
  liveStatus: TelegramWebhookLiveStatus,
  liveWebhookUrl: string | null,
  liveDescription: string | null,
  secretTokenConfigured: boolean,
): void {
  webhookReadiness = {
    ...webhookReadiness,
    liveStatus,
    liveWebhookUrl,
    liveDescription,
    secretTokenConfigured,
  };
}

function hasExpectedAllowedUpdates(value: unknown): boolean {
  if (!Array.isArray(value)) {
    // Telegram may omit this field when it has the default update set. The
    // URL is still useful for detecting externally replaced webhooks.
    return true;
  }

  return (
    value.length === EXPECTED_ALLOWED_UPDATES.length &&
    EXPECTED_ALLOWED_UPDATES.every((update) => value.includes(update))
  );
}

function isRelaxedWebhookEnvironment(token: string | undefined): boolean {
  return process.env.NODE_ENV !== "production" && Boolean(token);
}

async function performTelegramWebhookCheck(requestHost?: string): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const secretToken = getTelegramWebhookSecret();
  const webhookUrl = getConfiguredWebhookUrl(requestHost);
  const sensitiveValues = [token, secretToken];
  const relaxedEnvironment = isRelaxedWebhookEnvironment(token);

  if (!token) {
    updateLiveWebhookReadiness(
      "unavailable",
      null,
      "TELEGRAM_BOT_TOKEN not set — cannot inspect the live Telegram webhook",
      false,
    );
    return;
  }

  if (!secretToken) {
    updateLiveWebhookReadiness(
      "unavailable",
      null,
      "TELEGRAM_WEBHOOK_SECRET not set — cannot verify webhook expectations",
      false,
    );
    return;
  }

  if (!webhookUrl) {
    if (relaxedEnvironment) {
      updateLiveWebhookReadiness(
        "matching",
        null,
        "Development/staging webhook URL checks are advisory",
        true,
      );
      return;
    }

    updateLiveWebhookReadiness(
      "unavailable",
      null,
      "Cannot determine the configured public webhook URL",
      true,
    );
    return;
  }

  try {
    const response = await fetch(
      `https://api.telegram.org/bot${token}/getWebhookInfo`,
      { method: "GET" },
    );
    const data = (await response.json()) as TelegramWebhookInfoResponse;

    if (!response.ok || !data.ok) {
      updateLiveWebhookReadiness(
        "unavailable",
        null,
        getSafeTelegramDescription(
          data.description,
          sensitiveValues,
          "Telegram did not provide a webhook inspection error",
        ),
        true,
      );
      return;
    }

    const info = data.result ?? {};
    const liveWebhookUrl =
      typeof info.url === "string"
        ? redactSensitiveValues(info.url, sensitiveValues)
        : null;

    if (!liveWebhookUrl) {
      updateLiveWebhookReadiness(
        "stale",
        null,
        "Telegram has no active webhook configured",
        true,
      );
      return;
    }

    if (
      liveWebhookUrl !== webhookUrl ||
      !hasExpectedAllowedUpdates(info.allowed_updates)
    ) {
      if (relaxedEnvironment) {
        updateLiveWebhookReadiness(
          "matching",
          liveWebhookUrl,
          "Development/staging webhook URL drift is advisory",
          true,
        );
        return;
      }

      updateLiveWebhookReadiness(
        "out_of_band",
        liveWebhookUrl,
        "Telegram webhook configuration differs from the app configuration",
        true,
      );
      return;
    }

    if (typeof info.last_error_date === "number") {
      updateLiveWebhookReadiness(
        "stale",
        liveWebhookUrl,
        getSafeTelegramDescription(
          info.last_error_message,
          sensitiveValues,
          "Telegram reported a recent webhook delivery error",
        ),
        true,
      );
      return;
    }

    updateLiveWebhookReadiness("matching", liveWebhookUrl, null, true);
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    updateLiveWebhookReadiness(
      "unavailable",
      null,
      redactSensitiveValues(
        `Telegram webhook inspection failed: ${reason}`,
        sensitiveValues,
      ),
      true,
    );
  }
}

/**
 * Compare Telegram's live webhook configuration with this app's expectations.
 *
 * Telegram does not return the configured secret token from getWebhookInfo,
 * so this verifies the URL and allowed updates while reporting whether the
 * app has a secret configured. The secret remains write-only from Telegram's
 * API and is never included in health output or diagnostics.
 */
export function checkTelegramWebhook(requestHost?: string): Promise<void> {
  if (!liveWebhookCheck) {
    liveWebhookCheck = performTelegramWebhookCheck(requestHost).finally(() => {
      liveWebhookCheck = null;
    });
  }

  return liveWebhookCheck;
}

export async function registerTelegramWebhook(requestHost?: string): Promise<void> {
  webhookReadiness = {
    status: "pending",
    webhookUrl: getConfiguredWebhookUrl(requestHost),
    description: null,
  };

  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    logger.warn("TELEGRAM_BOT_TOKEN not set — skipping webhook registration");
    return;
  }

  const secretToken = getTelegramWebhookSecret();
  if (!secretToken) {
    logger.warn(
      "TELEGRAM_WEBHOOK_SECRET not set — skipping webhook registration",
    );
    return;
  }

  const base = getPublicBaseUrl(requestHost);
  if (!base) {
    logger.warn(
      "Cannot determine public URL (request host/REPLIT_DEV_DOMAIN/REPLIT_DOMAINS not set) — skipping webhook registration",
    );
    return;
  }

  const webhookUrl = `${base}${TELEGRAM_WEBHOOK_PATH}`;
  const sensitiveValues = [token, secretToken];

  let lastFailure: {
    description: string;
    retryable: boolean;
    retryDelayMs: number;
  } | null = null;

  for (
    let attempt = 1;
    attempt <= TELEGRAM_WEBHOOK_MAX_ATTEMPTS;
    attempt += 1
  ) {
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
        parameters?: unknown;
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
        retryDelayMs: getTelegramRetryDelayMs(res.status, data.parameters),
      };
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      lastFailure = {
        description: reason,
        retryable: true,
        retryDelayMs: TELEGRAM_WEBHOOK_RETRY_DELAY_MS,
      };
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
    await waitForRetry(lastFailure.retryDelayMs);
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
