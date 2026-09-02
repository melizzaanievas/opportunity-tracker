import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { registerTelegramWebhook } from "../src/lib/register-webhook.ts";

const TELEGRAM_BOT_TOKEN = "register-webhook-test-token";
const TELEGRAM_WEBHOOK_SECRET = "register-webhook-test-secret";
const TELEGRAM_API_URL = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/setWebhook`;

const environmentKeys = [
  "REPLIT_DOMAINS",
  "REPLIT_DEV_DOMAIN",
  "TELEGRAM_BOT_TOKEN",
  "TELEGRAM_WEBHOOK_SECRET",
] as const;

const originalEnvironment = Object.fromEntries(
  environmentKeys.map((key) => [key, process.env[key]]),
) as Record<(typeof environmentKeys)[number], string | undefined>;

afterEach(() => {
  for (const key of environmentKeys) {
    const value = originalEnvironment[key];
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
});

describe("Telegram webhook registration", () => {
  it("registers the configured webhook URL with its secret token", async () => {
    process.env.REPLIT_DOMAINS = "example.replit.app";
    delete process.env.REPLIT_DEV_DOMAIN;
    process.env.TELEGRAM_BOT_TOKEN = TELEGRAM_BOT_TOKEN;
    process.env.TELEGRAM_WEBHOOK_SECRET = TELEGRAM_WEBHOOK_SECRET;

    const calls: Array<{ url: string; body: Record<string, unknown> }> = [];
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async (input, init) => {
      const url =
        typeof input === "string"
          ? input
          : input instanceof URL
            ? input.href
            : input.url;
      assert.equal(url, TELEGRAM_API_URL);
      calls.push({
        url,
        body: JSON.parse(String(init?.body)) as Record<string, unknown>,
      });
      return new Response(JSON.stringify({ ok: true, result: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }) as typeof fetch;

    try {
      await registerTelegramWebhook();
    } finally {
      globalThis.fetch = originalFetch;
    }

    assert.equal(calls.length, 1);
    assert.equal(calls[0]?.body.url, "https://example.replit.app/api/integrations/telegram-webhook");
    assert.equal(calls[0]?.body.secret_token, TELEGRAM_WEBHOOK_SECRET);
  });

  it("skips registration when the webhook secret is missing", async () => {
    process.env.REPLIT_DOMAINS = "example.replit.app";
    delete process.env.REPLIT_DEV_DOMAIN;
    process.env.TELEGRAM_BOT_TOKEN = TELEGRAM_BOT_TOKEN;
    delete process.env.TELEGRAM_WEBHOOK_SECRET;

    let fetchCalls = 0;
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async () => {
      fetchCalls += 1;
      throw new Error("Telegram should not be contacted without a webhook secret");
    }) as typeof fetch;

    try {
      await registerTelegramWebhook();
    } finally {
      globalThis.fetch = originalFetch;
    }

    assert.equal(fetchCalls, 0);
  });

  it("surfaces Telegram rejection details without exposing credentials", async () => {
    process.env.REPLIT_DOMAINS = "example.replit.app";
    delete process.env.REPLIT_DEV_DOMAIN;
    process.env.TELEGRAM_BOT_TOKEN = TELEGRAM_BOT_TOKEN;
    process.env.TELEGRAM_WEBHOOK_SECRET = TELEGRAM_WEBHOOK_SECRET;

    const rejectionDescription = "Webhook URL must be HTTPS";
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async (input) => {
      const url =
        typeof input === "string"
          ? input
          : input instanceof URL
            ? input.href
            : input.url;
      assert.equal(url, TELEGRAM_API_URL);
      return new Response(
        JSON.stringify({ ok: false, description: rejectionDescription }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      );
    }) as typeof fetch;

    try {
      await assert.rejects(
        registerTelegramWebhook(),
        (error: unknown) => {
          assert(error instanceof Error);
          assert.match(
            error.message,
            /https:\/\/example\.replit\.app\/api\/integrations\/telegram-webhook/,
          );
          assert.match(error.message, new RegExp(rejectionDescription));
          assert.doesNotMatch(error.message, new RegExp(TELEGRAM_BOT_TOKEN));
          assert.doesNotMatch(error.message, new RegExp(TELEGRAM_WEBHOOK_SECRET));
          return true;
        },
      );
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});