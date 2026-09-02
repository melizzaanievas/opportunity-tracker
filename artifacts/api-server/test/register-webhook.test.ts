import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";
import { afterEach, describe, it } from "node:test";
import express from "express";
import healthRouter from "../src/routes/health.ts";
import {
  checkTelegramWebhook,
  getTelegramWebhookReadiness,
  registerTelegramWebhook,
} from "../src/lib/register-webhook.ts";

const TELEGRAM_BOT_TOKEN = "register-webhook-test-token";
const TELEGRAM_WEBHOOK_SECRET = "register-webhook-test-secret";
const TELEGRAM_API_URL = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/setWebhook`;
const TELEGRAM_WEBHOOK_INFO_URL = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getWebhookInfo`;
const EXPECTED_WEBHOOK_URL =
  "https://example.replit.app/api/integrations/telegram-webhook";

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

async function fetchHealth(query = ""): Promise<Record<string, unknown>> {
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
    const response = await fetch(
      `http://127.0.0.1:${address.port}/healthz${query}`,
    );
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

  it("retries a transient fetch failure and succeeds", async () => {
    process.env.REPLIT_DOMAINS = "example.replit.app";
    delete process.env.REPLIT_DEV_DOMAIN;
    process.env.TELEGRAM_BOT_TOKEN = TELEGRAM_BOT_TOKEN;
    process.env.TELEGRAM_WEBHOOK_SECRET = TELEGRAM_WEBHOOK_SECRET;

    let fetchCalls = 0;
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async () => {
      fetchCalls += 1;
      if (fetchCalls === 1) {
        throw new Error("temporary network outage");
      }
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

    assert.equal(fetchCalls, 2);
    assert.equal(getTelegramWebhookReadiness().status, "successful");
  });

  it("retries a retryable Telegram response until it succeeds", async () => {
    process.env.REPLIT_DOMAINS = "example.replit.app";
    delete process.env.REPLIT_DEV_DOMAIN;
    process.env.TELEGRAM_BOT_TOKEN = TELEGRAM_BOT_TOKEN;
    process.env.TELEGRAM_WEBHOOK_SECRET = TELEGRAM_WEBHOOK_SECRET;

    let fetchCalls = 0;
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async () => {
      fetchCalls += 1;
      if (fetchCalls < 3) {
        return new Response(
          JSON.stringify({ ok: false, description: "Telegram is busy" }),
          {
            status: 429,
            headers: { "Content-Type": "application/json" },
          },
        );
      }
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

    assert.equal(fetchCalls, 3);
    assert.equal(getTelegramWebhookReadiness().status, "successful");
  });

  it("uses Telegram's retry hint for a retryable rate-limit response", async () => {
    process.env.REPLIT_DOMAINS = "example.replit.app";
    delete process.env.REPLIT_DEV_DOMAIN;
    process.env.TELEGRAM_BOT_TOKEN = TELEGRAM_BOT_TOKEN;
    process.env.TELEGRAM_WEBHOOK_SECRET = TELEGRAM_WEBHOOK_SECRET;

    const retryDelays: number[] = [];
    const originalSetTimeout = globalThis.setTimeout;
    const originalFetch = globalThis.fetch;
    let fetchCalls = 0;
    globalThis.setTimeout = ((callback, delay) => {
      retryDelays.push(Number(delay));
      callback();
      return 0 as unknown as ReturnType<typeof setTimeout>;
    }) as typeof setTimeout;
    globalThis.fetch = (async () => {
      fetchCalls += 1;
      if (fetchCalls === 1) {
        return new Response(
          JSON.stringify({
            ok: false,
            description: "Too Many Requests",
            parameters: { retry_after: 2 },
          }),
          {
            status: 429,
            headers: { "Content-Type": "application/json" },
          },
        );
      }
      return new Response(JSON.stringify({ ok: true, result: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }) as typeof fetch;

    try {
      await registerTelegramWebhook();
    } finally {
      globalThis.setTimeout = originalSetTimeout;
      globalThis.fetch = originalFetch;
    }

    assert.equal(fetchCalls, 2);
    assert.deepEqual(retryDelays, [2_000]);
  });

  it("caps Telegram's retry hint so registration does not wait indefinitely", async () => {
    process.env.REPLIT_DOMAINS = "example.replit.app";
    delete process.env.REPLIT_DEV_DOMAIN;
    process.env.TELEGRAM_BOT_TOKEN = TELEGRAM_BOT_TOKEN;
    process.env.TELEGRAM_WEBHOOK_SECRET = TELEGRAM_WEBHOOK_SECRET;

    const retryDelays: number[] = [];
    const originalSetTimeout = globalThis.setTimeout;
    const originalFetch = globalThis.fetch;
    let fetchCalls = 0;
    globalThis.setTimeout = ((callback, delay) => {
      retryDelays.push(Number(delay));
      callback();
      return 0 as unknown as ReturnType<typeof setTimeout>;
    }) as typeof setTimeout;
    globalThis.fetch = (async () => {
      fetchCalls += 1;
      if (fetchCalls === 1) {
        return new Response(
          JSON.stringify({
            ok: false,
            description: "Too Many Requests",
            parameters: { retry_after: 60 },
          }),
          {
            status: 429,
            headers: { "Content-Type": "application/json" },
          },
        );
      }
      return new Response(JSON.stringify({ ok: true, result: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }) as typeof fetch;

    try {
      await registerTelegramWebhook();
    } finally {
      globalThis.setTimeout = originalSetTimeout;
      globalThis.fetch = originalFetch;
    }

    assert.equal(fetchCalls, 2);
    assert.deepEqual(retryDelays, [5_000]);
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
    let fetchCalls = 0;
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async (input) => {
      fetchCalls += 1;
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

    assert.equal(fetchCalls, 1);
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

  it("stops after the retry limit and exposes the final safe transient failure", async () => {
    process.env.REPLIT_DOMAINS = "example.replit.app";
    delete process.env.REPLIT_DEV_DOMAIN;
    process.env.TELEGRAM_BOT_TOKEN = TELEGRAM_BOT_TOKEN;
    process.env.TELEGRAM_WEBHOOK_SECRET = TELEGRAM_WEBHOOK_SECRET;

    let fetchCalls = 0;
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async () => {
      fetchCalls += 1;
      throw new Error(
        `temporary failure for ${TELEGRAM_BOT_TOKEN} with ${TELEGRAM_WEBHOOK_SECRET}`,
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
          /temporary failure for \[REDACTED\] with \[REDACTED\]/,
        );
        return true;
      });
    } finally {
      globalThis.fetch = originalFetch;
    }

    assert.equal(fetchCalls, 3);
    assert.deepEqual(getTelegramWebhookReadiness(), {
      status: "failed",
      webhookUrl: EXPECTED_WEBHOOK_URL,
      description: "temporary failure for [REDACTED] with [REDACTED]",
    });
  });

  it("reports when Telegram's live webhook matches the app configuration", async () => {
    process.env.REPLIT_DOMAINS = "example.replit.app";
    delete process.env.REPLIT_DEV_DOMAIN;
    process.env.TELEGRAM_BOT_TOKEN = TELEGRAM_BOT_TOKEN;
    process.env.TELEGRAM_WEBHOOK_SECRET = TELEGRAM_WEBHOOK_SECRET;

    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async (input) => {
      const url =
        typeof input === "string"
          ? input
          : input instanceof URL
            ? input.href
            : input.url;
      if (url === TELEGRAM_API_URL) {
        return new Response(JSON.stringify({ ok: true, result: true }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      assert.equal(url, TELEGRAM_WEBHOOK_INFO_URL);
      return new Response(
        JSON.stringify({
          ok: true,
          result: {
            url: EXPECTED_WEBHOOK_URL,
            allowed_updates: ["callback_query", "message"],
          },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }) as typeof fetch;

    try {
      await registerTelegramWebhook();
      await checkTelegramWebhook();
    } finally {
      globalThis.fetch = originalFetch;
    }

    assert.deepEqual(getTelegramWebhookReadiness(), {
      status: "successful",
      webhookUrl: EXPECTED_WEBHOOK_URL,
      description: null,
      liveStatus: "matching",
      liveWebhookUrl: EXPECTED_WEBHOOK_URL,
      liveDescription: null,
      secretTokenConfigured: true,
    });
  });

  it("reports an out-of-band live webhook without exposing credentials", async () => {
    process.env.REPLIT_DOMAINS = "example.replit.app";
    delete process.env.REPLIT_DEV_DOMAIN;
    process.env.TELEGRAM_BOT_TOKEN = TELEGRAM_BOT_TOKEN;
    process.env.TELEGRAM_WEBHOOK_SECRET = TELEGRAM_WEBHOOK_SECRET;

    const externalUrl = `https://external.example/${TELEGRAM_BOT_TOKEN}`;
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async (input) => {
      const url =
        typeof input === "string"
          ? input
          : input instanceof URL
            ? input.href
            : input.url;
      if (url === TELEGRAM_API_URL) {
        return new Response(JSON.stringify({ ok: true, result: true }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      assert.equal(url, TELEGRAM_WEBHOOK_INFO_URL);
      return new Response(
        JSON.stringify({
          ok: true,
          result: { url: externalUrl, allowed_updates: ["message"] },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }) as typeof fetch;

    try {
      await registerTelegramWebhook();
      await checkTelegramWebhook();
    } finally {
      globalThis.fetch = originalFetch;
    }

    const health = await fetchHealth();
    assert.deepEqual(health.telegramWebhook, {
      status: "successful",
      webhookUrl: EXPECTED_WEBHOOK_URL,
      description: null,
      liveStatus: "out_of_band",
      liveWebhookUrl: "https://external.example/[REDACTED]",
      liveDescription:
        "Telegram webhook configuration differs from the app configuration",
      secretTokenConfigured: true,
    });
    assert.doesNotMatch(JSON.stringify(health), new RegExp(TELEGRAM_BOT_TOKEN));
    assert.doesNotMatch(
      JSON.stringify(health),
      new RegExp(TELEGRAM_WEBHOOK_SECRET),
    );
  });

  it("reports a stale live webhook when Telegram has no active URL", async () => {
    process.env.REPLIT_DOMAINS = "example.replit.app";
    delete process.env.REPLIT_DEV_DOMAIN;
    process.env.TELEGRAM_BOT_TOKEN = TELEGRAM_BOT_TOKEN;
    process.env.TELEGRAM_WEBHOOK_SECRET = TELEGRAM_WEBHOOK_SECRET;

    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async () =>
      new Response(JSON.stringify({ ok: true, result: { url: "" } }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })) as typeof fetch;

    try {
      await checkTelegramWebhook();
    } finally {
      globalThis.fetch = originalFetch;
    }

    assert.equal(getTelegramWebhookReadiness().liveStatus, "stale");
    assert.equal(
      getTelegramWebhookReadiness().liveDescription,
      "Telegram has no active webhook configured",
    );
  });

  it("refreshes the live webhook status when health is requested on demand", async () => {
    process.env.REPLIT_DOMAINS = "example.replit.app";
    delete process.env.REPLIT_DEV_DOMAIN;
    process.env.TELEGRAM_BOT_TOKEN = TELEGRAM_BOT_TOKEN;
    process.env.TELEGRAM_WEBHOOK_SECRET = TELEGRAM_WEBHOOK_SECRET;

    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async (input) => {
      const url =
        typeof input === "string"
          ? input
          : input instanceof URL
            ? input.href
            : input.url;
      if (url.startsWith("http://127.0.0.1:")) {
        return originalFetch(input);
      }
      assert.equal(url, TELEGRAM_WEBHOOK_INFO_URL);
      return new Response(
        JSON.stringify({
          ok: true,
          result: { url: EXPECTED_WEBHOOK_URL },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }) as typeof fetch;

    try {
      const health = await fetchHealth("?refresh=1");
      assert.equal(
        (health.telegramWebhook as Record<string, unknown>).liveStatus,
        "matching",
      );
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("reports a safe unavailable state when live inspection fails", async () => {
    process.env.REPLIT_DOMAINS = "example.replit.app";
    delete process.env.REPLIT_DEV_DOMAIN;
    process.env.TELEGRAM_BOT_TOKEN = TELEGRAM_BOT_TOKEN;
    process.env.TELEGRAM_WEBHOOK_SECRET = TELEGRAM_WEBHOOK_SECRET;

    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async () => {
      throw new Error(
        `Telegram request failed for ${TELEGRAM_BOT_TOKEN} and ${TELEGRAM_WEBHOOK_SECRET}`,
      );
    }) as typeof fetch;

    try {
      await checkTelegramWebhook();
    } finally {
      globalThis.fetch = originalFetch;
    }

    const readiness = getTelegramWebhookReadiness();
    assert.equal(readiness.liveStatus, "unavailable");
    assert.equal(
      readiness.liveDescription,
      "Telegram webhook inspection failed: Telegram request failed for [REDACTED] and [REDACTED]",
    );
    assert.doesNotMatch(
      JSON.stringify(readiness),
      new RegExp(TELEGRAM_BOT_TOKEN),
    );
    assert.doesNotMatch(
      JSON.stringify(readiness),
      new RegExp(TELEGRAM_WEBHOOK_SECRET),
    );
  });
});
