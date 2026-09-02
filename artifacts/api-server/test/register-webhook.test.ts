import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";
import { afterEach, describe, it } from "node:test";
import express from "express";
import healthRouter from "../src/routes/health.ts";
import { registerTelegramWebhook } from "../src/lib/register-webhook.ts";
import { getTelegramWebhookReadiness } from "../src/lib/register-webhook.ts";

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


async function fetchHealth(): Promise<Record<string, unknown>> {
  const server: Server = createServer(express().use(healthRouter));
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => resolve());
  });

  const address = server.address();
  if (!address || typeof address === "string") {
    server.close();
    throw new Error("Health test server did not expose an address");
  }

  try {
    const response = await fetch(`http://127.0.0.1:${address.port}/healthz`);
    assert.equal(response.status, 200);
    return (await response.json()) as Record<string, unknown>;
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
  }
}

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
    assert.equal(
      calls[0]?.body.url,
      "https://example.replit.app/api/integrations/telegram-webhook",
    );
    assert.equal(calls[0]?.body.secret_token, TELEGRAM_WEBHOOK_SECRET);
    assert.deepEqual(getTelegramWebhookReadiness(), {
      status: "successful",
      webhookUrl:
        "https://example.replit.app/api/integrations/telegram-webhook",
      description: null,
    });
  });

  it("reports pending while Telegram registration is in progress", async () => {
    process.env.REPLIT_DOMAINS = "example.replit.app";
    delete process.env.REPLIT_DEV_DOMAIN;
    process.env.TELEGRAM_BOT_TOKEN = TELEGRAM_BOT_TOKEN;
    process.env.TELEGRAM_WEBHOOK_SECRET = TELEGRAM_WEBHOOK_SECRET;

    let resolveResponse!: (response: Response) => void;
    const response = new Promise<Response>((resolve) => {
      resolveResponse = resolve;
    });
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async () => response) as typeof fetch;

    try {
      const registration = registerTelegramWebhook();
      assert.deepEqual(getTelegramWebhookReadiness(), {
        status: "pending",
        webhookUrl:
          "https://example.replit.app/api/integrations/telegram-webhook",
        description: null,
      });

      resolveResponse(
        new Response(JSON.stringify({ ok: true, result: true }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );
      await registration;
    } finally {
      globalThis.fetch = originalFetch;
    }

    assert.equal(getTelegramWebhookReadiness().status, "successful");
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
      throw new Error(
        "Telegram should not be contacted without a webhook secret",
      );
    }) as typeof fetch;

    try {
      await registerTelegramWebhook();
    } finally {
      globalThis.fetch = originalFetch;
    }

    assert.equal(fetchCalls, 0);
    assert.deepEqual(getTelegramWebhookReadiness(), {
      status: "pending",
      webhookUrl:
        "https://example.replit.app/api/integrations/telegram-webhook",
      description: null,
    });
  });

  it("exposes a safe failed state through health without exposing credentials", async () => {
    process.env.REPLIT_DOMAINS = "example.replit.app";
    delete process.env.REPLIT_DEV_DOMAIN;
    process.env.TELEGRAM_BOT_TOKEN = TELEGRAM_BOT_TOKEN;
    process.env.TELEGRAM_WEBHOOK_SECRET = TELEGRAM_WEBHOOK_SECRET;

    const rejectionDescription = `Webhook URL rejected for ${TELEGRAM_BOT_TOKEN} using ${TELEGRAM_WEBHOOK_SECRET}`;
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
      await assert.rejects(registerTelegramWebhook(), (error: unknown) => {
        assert(error instanceof Error);
        assert.match(
          error.message,
          /https:\/\/example\.replit\.app\/api\/integrations\/telegram-webhook/,
        );
        assert.match(
          error.message,
          /Webhook URL rejected for \[REDACTED\] using \[REDACTED\]/,
        );
        assert.doesNotMatch(error.message, new RegExp(TELEGRAM_BOT_TOKEN));
        assert.doesNotMatch(error.message, new RegExp(TELEGRAM_WEBHOOK_SECRET));
        return true;
      });
    } finally {
      globalThis.fetch = originalFetch;
    }

    assert.deepEqual(getTelegramWebhookReadiness(), {
      status: "failed",
      webhookUrl:
        "https://example.replit.app/api/integrations/telegram-webhook",
      description: "Webhook URL rejected for [REDACTED] using [REDACTED]",
    });

    const health = await fetchHealth();
    assert.deepEqual(health.telegramWebhook, {
      status: "failed",
      webhookUrl:
        "https://example.replit.app/api/integrations/telegram-webhook",
      description: "Webhook URL rejected for [REDACTED] using [REDACTED]",
    });
    assert.doesNotMatch(JSON.stringify(health), new RegExp(TELEGRAM_BOT_TOKEN));
    assert.doesNotMatch(
      JSON.stringify(health),
      new RegExp(TELEGRAM_WEBHOOK_SECRET),
    );
  });
});