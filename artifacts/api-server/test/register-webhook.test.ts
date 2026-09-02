import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";
import { afterEach, describe, it } from "node:test";
import express from "express";
import session from "express-session";
import pinoHttp from "pino-http";
import healthRouter from "../src/routes/health.ts";
import {
  checkTelegramWebhook,
  getTelegramWebhookReadiness,
  registerTelegramWebhook,
} from "../src/lib/register-webhook.ts";
import { getTelegramWebhookSecret } from "../src/lib/telegram.ts";
import { logger } from "../src/lib/logger.ts";

const TELEGRAM_BOT_TOKEN = "register-webhook-test-token";
const TELEGRAM_WEBHOOK_SECRET = "register-webhook-test-secret";
const TELEGRAM_API_URL = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/setWebhook`;
const TELEGRAM_WEBHOOK_INFO_URL = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getWebhookInfo`;
const EXPECTED_WEBHOOK_URL =
  "https://example.replit.app/api/telegram/webhook";

const environmentKeys = [
  "REPLIT_DOMAINS",
  "REPLIT_DEV_DOMAIN",
  "NODE_ENV",
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

async function fetchWebhookRecovery(
  authenticated = true,
): Promise<{ status: number; body: Record<string, unknown> }> {
  const app = express();
  app.use(pinoHttp({ logger }));
  app.use(
    session({
      secret: "webhook-recovery-test-session",
      resave: false,
      saveUninitialized: false,
    }),
  );
  app.use((req, _res, next) => {
    if (authenticated) {
      req.session.authenticated = true;
    }
    next();
  });
  app.use(healthRouter);

  const server: Server = createServer(app);
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => resolve());
  });

  const address = server.address();
  if (!address || typeof address === "string") {
    server.close();
    throw new Error("Webhook recovery test server did not expose an address");
  }

  try {
    const response = await fetch(
      `http://127.0.0.1:${address.port}/integrations/telegram-webhook/register`,
      { method: "POST" },
    );
    return {
      status: response.status,
      body: (await response.json()) as Record<string, unknown>,
    };
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
  }
}

describe("Telegram webhook registration", () => {
  it("requires authentication for dashboard webhook recovery", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async (input, init) => {
      const url =
        typeof input === "string"
          ? input
          : input instanceof URL
            ? input.href
            : input.url;
      if (url.startsWith("http://127.0.0.1:")) {
        return originalFetch(input, init);
      }
      throw new Error("Telegram must not be contacted by unauthenticated callers");
    }) as typeof fetch;

    try {
      const response = await fetchWebhookRecovery(false);
      assert.equal(response.status, 401);
      assert.deepEqual(response.body, { error: "Unauthorized" });
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("re-registers the configured webhook through the authenticated recovery route", async () => {
    process.env.REPLIT_DOMAINS = "example.replit.app";
    delete process.env.REPLIT_DEV_DOMAIN;
    process.env.TELEGRAM_BOT_TOKEN = TELEGRAM_BOT_TOKEN;
    process.env.TELEGRAM_WEBHOOK_SECRET = TELEGRAM_WEBHOOK_SECRET;

    let requestBody: Record<string, unknown> | undefined;
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async (input, init) => {
      const url =
        typeof input === "string"
          ? input
          : input instanceof URL
            ? input.href
            : input.url;
      if (url.startsWith("http://127.0.0.1:")) {
        return originalFetch(input, init);
      }
      assert.equal(url, TELEGRAM_API_URL);
      requestBody = JSON.parse(String(init?.body)) as Record<string, unknown>;
      return new Response(JSON.stringify({ ok: true, result: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }) as typeof fetch;

    try {
      const response = await fetchWebhookRecovery();
      assert.equal(response.status, 200);
      assert.equal(
        (response.body.telegramWebhook as Record<string, unknown>).status,
        "successful",
      );
      assert.equal(requestBody?.url, EXPECTED_WEBHOOK_URL);
      assert.equal(requestBody?.secret_token, TELEGRAM_WEBHOOK_SECRET);
      assert.doesNotMatch(JSON.stringify(response.body), new RegExp(TELEGRAM_WEBHOOK_SECRET));
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("returns a safe failure and preserves failed readiness after recovery is rejected", async () => {
    process.env.REPLIT_DOMAINS = "example.replit.app";
    delete process.env.REPLIT_DEV_DOMAIN;
    process.env.TELEGRAM_BOT_TOKEN = TELEGRAM_BOT_TOKEN;
    process.env.TELEGRAM_WEBHOOK_SECRET = TELEGRAM_WEBHOOK_SECRET;

    const rejectionDescription = `Webhook rejected ${TELEGRAM_BOT_TOKEN} using ${TELEGRAM_WEBHOOK_SECRET}`;
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async (input, init) => {
      const url =
        typeof input === "string"
          ? input
          : input instanceof URL
            ? input.href
            : input.url;
      if (url.startsWith("http://127.0.0.1:")) {
        return originalFetch(input, init);
      }
      return new Response(
        JSON.stringify({
          ok: false,
          description: rejectionDescription,
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        },
      );
    }) as typeof fetch;

    try {
      const response = await fetchWebhookRecovery();
      assert.equal(response.status, 502);
      assert.match(String(response.body.error), /Telegram webhook registration failed/);
      assert.doesNotMatch(JSON.stringify(response.body), new RegExp(TELEGRAM_BOT_TOKEN));
      assert.doesNotMatch(JSON.stringify(response.body), new RegExp(TELEGRAM_WEBHOOK_SECRET));
      assert.equal(getTelegramWebhookReadiness().status, "failed");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

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
      EXPECTED_WEBHOOK_URL,
    );
    assert.equal(calls[0]?.body.secret_token, TELEGRAM_WEBHOOK_SECRET);
    assert.deepEqual(getTelegramWebhookReadiness(), {
      status: "successful",
      webhookUrl:
        EXPECTED_WEBHOOK_URL,
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
          EXPECTED_WEBHOOK_URL,
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

  it("uses the bounded fallback for malformed Telegram retry hints", async () => {
    process.env.REPLIT_DOMAINS = "example.replit.app";
    delete process.env.REPLIT_DEV_DOMAIN;
    process.env.TELEGRAM_BOT_TOKEN = TELEGRAM_BOT_TOKEN;
    process.env.TELEGRAM_WEBHOOK_SECRET = TELEGRAM_WEBHOOK_SECRET;

    const invalidHints: Array<{ name: string; parameters: unknown }> = [
      { name: "a missing retry_after value", parameters: {} },
      { name: "a non-numeric retry_after value", parameters: { retry_after: "2" } },
      { name: "a negative retry_after value", parameters: { retry_after: -1 } },
      { name: "a NaN retry_after value", parameters: { retry_after: Number.NaN } },
      {
        name: "an Infinity retry_after value",
        parameters: { retry_after: Number.POSITIVE_INFINITY },
      },
    ];

    for (const { name, parameters } of invalidHints) {
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
          return {
            ok: false,
            status: 429,
            json: async () => ({
              ok: false,
              description: "Too Many Requests",
              parameters,
            }),
          } as Response;
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

      assert.equal(fetchCalls, 2, name);
      assert.deepEqual(retryDelays, [250], name);
    }
  });

  it("skips registration when the webhook secret is missing", async () => {
    process.env.NODE_ENV = "production";
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
        EXPECTED_WEBHOOK_URL,
      description: null,
    });
  });

  it("uses a local fallback secret when development has no configured secret", async () => {
    process.env.NODE_ENV = "development";
    process.env.REPLIT_DOMAINS = "example.replit.app";
    delete process.env.REPLIT_DEV_DOMAIN;
    process.env.TELEGRAM_BOT_TOKEN = TELEGRAM_BOT_TOKEN;
    delete process.env.TELEGRAM_WEBHOOK_SECRET;

    let requestBody: Record<string, unknown> | undefined;
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async (input, init) => {
      assert.equal(input, TELEGRAM_API_URL);
      requestBody = JSON.parse(String(init?.body)) as Record<string, unknown>;
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

    assert.equal(requestBody?.secret_token, getTelegramWebhookSecret());
    assert.notEqual(requestBody?.secret_token, undefined);
    assert.equal(getTelegramWebhookReadiness().status, "successful");
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
          /https:\/\/example\.replit\.app\/api\/telegram\/webhook/,
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
        EXPECTED_WEBHOOK_URL,
      description: "Webhook URL rejected for [REDACTED] using [REDACTED]",
    });

    const health = await fetchHealth();
    assert.deepEqual(health.telegramWebhook, {
      status: "failed",
      webhookUrl:
        EXPECTED_WEBHOOK_URL,
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
          /https:\/\/example\.replit\.app\/api\/telegram\/webhook/,
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
    process.env.NODE_ENV = "production";
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
    process.env.NODE_ENV = "production";
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
    process.env.NODE_ENV = "production";
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

  it("treats development URL drift as advisory when Telegram is configured", async () => {
    process.env.NODE_ENV = "development";
    delete process.env.REPLIT_DOMAINS;
    process.env.REPLIT_DEV_DOMAIN = "current.replit.dev";
    process.env.TELEGRAM_BOT_TOKEN = TELEGRAM_BOT_TOKEN;
    process.env.TELEGRAM_WEBHOOK_SECRET = TELEGRAM_WEBHOOK_SECRET;

    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async () =>
      new Response(
        JSON.stringify({
          ok: true,
          result: {
            url: "https://previous.replit.dev/api/telegram/webhook",
            allowed_updates: ["message"],
          },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      )) as typeof fetch;

    try {
      await checkTelegramWebhook();
    } finally {
      globalThis.fetch = originalFetch;
    }

    const readiness = getTelegramWebhookReadiness();
    assert.equal(readiness.liveStatus, "matching");
    assert.equal(
      readiness.liveWebhookUrl,
      "https://previous.replit.dev/api/telegram/webhook",
    );
    assert.equal(
      readiness.liveDescription,
      "Development/staging webhook URL drift is advisory",
    );
    assert.equal(readiness.secretTokenConfigured, true);
  });
});
