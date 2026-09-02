import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildTelegramWebhookDriftAlert,
  createTelegramWebhookMonitor,
} from "../src/lib/telegram-webhook-monitor.ts";
import type { TelegramWebhookReadiness } from "../src/lib/register-webhook.ts";

const BOT_TOKEN = "monitor-test-bot-token";
const WEBHOOK_SECRET = "monitor-test-webhook-secret";

function readiness(
  liveStatus: TelegramWebhookReadiness["liveStatus"],
  liveDescription: string | null = null,
): TelegramWebhookReadiness {
  return {
    status: "successful",
    webhookUrl: "https://example.replit.app/api/telegram/webhook",
    description: null,
    liveStatus,
    liveWebhookUrl: null,
    liveDescription,
    secretTokenConfigured: true,
  };
}

describe("Telegram webhook drift monitor", () => {
  it("builds actionable alerts without including credentials", () => {
    const alert = buildTelegramWebhookDriftAlert(
      readiness(
        "out_of_band",
        `Telegram rejected ${BOT_TOKEN} with ${WEBHOOK_SECRET}`,
      ),
    );

    assert(alert);
    assert.match(alert, /Telegram webhook is out of band/);
    assert.match(alert, /Review the Telegram webhook URL/);
    assert.doesNotMatch(alert, new RegExp(BOT_TOKEN));
    assert.doesNotMatch(alert, new RegExp(WEBHOOK_SECRET));
  });

  it("logs each webhook state transition without sending Telegram messages", async () => {
    let current = readiness("out_of_band");
    const monitor = createTelegramWebhookMonitor({
      getReadiness: () => current,
    });

    await monitor();
    await monitor();

    current = readiness("matching");
    await monitor();
    current = readiness("out_of_band");
    await monitor();
  });
});