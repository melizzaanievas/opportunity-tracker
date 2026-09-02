import { logger } from "./logger";
import {
  checkTelegramWebhook,
  getTelegramWebhookReadiness,
  type TelegramWebhookLiveStatus,
  type TelegramWebhookReadiness,
} from "./register-webhook";

const DRIFT_STATUSES = new Set<TelegramWebhookLiveStatus>([
  "out_of_band",
  "stale",
  "unavailable",
]);

type TelegramWebhookCheck = () => Promise<void>;
type TelegramWebhookReadinessGetter = () => TelegramWebhookReadiness;

export interface TelegramWebhookMonitorDependencies {
  check?: TelegramWebhookCheck;
  getReadiness?: TelegramWebhookReadinessGetter;
}

function getStatusLabel(status: TelegramWebhookLiveStatus): string {
  switch (status) {
    case "out_of_band":
      return "out of band";
    case "stale":
      return "stale";
    case "unavailable":
      return "unavailable";
    default:
      return status;
  }
}

function getAction(status: TelegramWebhookLiveStatus): string {
  switch (status) {
    case "out_of_band":
      return "Review the Telegram webhook URL and allowed updates, then re-register the app webhook.";
    case "stale":
      return "Re-register the Telegram webhook and confirm that Telegram is delivering updates again.";
    case "unavailable":
      return "Check Telegram API availability and the app's Telegram configuration, then refresh the health check.";
    default:
      return "";
  }
}

export function buildTelegramWebhookDriftAlert(
  readiness: TelegramWebhookReadiness,
): string | null {
  const status = readiness.liveStatus;
  if (!status || !DRIFT_STATUSES.has(status)) {
    return null;
  }

  return [
    `🚨 <b>Telegram webhook is ${getStatusLabel(status)}</b>`,
    "",
    getAction(status),
    "",
    "This alert will not repeat until the webhook recovers and drifts again.",
  ].join("\n");
}

/**
 * Creates a console-only webhook monitor with transition-based log suppression.
 *
 * Webhook diagnostics must never send messages to the configured Telegram chat.
 * Repeated checks with the same state are also suppressed so a persistent
 * problem cannot spam the server logs.
 */
export function createTelegramWebhookMonitor(
  dependencies: TelegramWebhookMonitorDependencies = {},
): () => Promise<void> {
  const check = dependencies.check ?? checkTelegramWebhook;
  const getReadiness =
    dependencies.getReadiness ?? getTelegramWebhookReadiness;
  let lastLoggedStatus: TelegramWebhookLiveStatus | null = null;

  return async () => {
    await check();

    const readiness = getReadiness();
    const status = readiness.liveStatus;
    if (!status) {
      return;
    }

    if (status === lastLoggedStatus) {
      return;
    }

    lastLoggedStatus = status;
    const details = {
      status,
      webhookUrl: readiness.webhookUrl,
      liveWebhookUrl: readiness.liveWebhookUrl,
      description: readiness.liveDescription,
    };

    if (status === "matching") {
      logger.info(details, "Telegram webhook status changed");
    } else if (DRIFT_STATUSES.has(status)) {
      logger.warn(details, "Telegram webhook status changed");
    }
  };
}