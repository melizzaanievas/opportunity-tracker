import { logger } from "./logger";
import {
  checkTelegramWebhook,
  getTelegramWebhookReadiness,
  type TelegramWebhookLiveStatus,
  type TelegramWebhookReadiness,
} from "./register-webhook";
import { sendTelegramMessage } from "./telegram";

const DRIFT_STATUSES = new Set<TelegramWebhookLiveStatus>([
  "out_of_band",
  "stale",
  "unavailable",
]);

type TelegramWebhookCheck = () => Promise<void>;
type TelegramWebhookReadinessGetter = () => TelegramWebhookReadiness;
type TelegramMessageSender = (text: string) => Promise<boolean>;

export interface TelegramWebhookMonitorDependencies {
  check?: TelegramWebhookCheck;
  getReadiness?: TelegramWebhookReadinessGetter;
  sendMessage?: TelegramMessageSender;
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
 * Creates a webhook monitor with transition-based alert suppression.
 *
 * A failed delivery is not treated as notified, so the next scheduled check
 * can retry it. Recovery clears the suppression key and allows a later drift
 * to alert again.
 */
export function createTelegramWebhookMonitor(
  dependencies: TelegramWebhookMonitorDependencies = {},
): () => Promise<void> {
  const check = dependencies.check ?? checkTelegramWebhook;
  const getReadiness =
    dependencies.getReadiness ?? getTelegramWebhookReadiness;
  const sendMessage = dependencies.sendMessage ?? sendTelegramMessage;
  let lastAlertedStatus: TelegramWebhookLiveStatus | null = null;

  return async () => {
    await check();

    const readiness = getReadiness();
    const status = readiness.liveStatus;
    if (!status || !DRIFT_STATUSES.has(status)) {
      lastAlertedStatus = null;
      return;
    }

    if (status === lastAlertedStatus) {
      return;
    }

    const alert = buildTelegramWebhookDriftAlert(readiness);
    if (!alert) {
      return;
    }

    const sent = await sendMessage(alert);
    if (sent) {
      lastAlertedStatus = status;
      logger.warn({ status }, "Telegram webhook drift alert sent");
    } else {
      logger.warn({ status }, "Telegram webhook drift alert could not be sent");
    }
  };
}