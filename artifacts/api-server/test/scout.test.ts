import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";
import { afterEach, beforeEach, describe, it } from "node:test";
import express, { type Express } from "express";
import { eq } from "drizzle-orm";
import { db, opportunitiesTable, scoutJobsTable } from "../src/db/index.ts";
import { formatScoutAlert, type ScoutPosting } from "../src/lib/scout.ts";
import { createTelegramWebhookRouter } from "../src/routes/telegram-webhook.ts";

const TELEGRAM_CHAT_ID = "scout-test-chat";
const TELEGRAM_BOT_TOKEN = "fake-scout-test-token";
const TELEGRAM_WEBHOOK_SECRET = "scout-webhook-secret";
const SCOUT_JOB_URL = "https://example.com/jobs/scout-123";

type TelegramCall = {
  method: string;
  body: Record<string, unknown>;
};

async function withServer<T>(
  app: Express,
  callback: (baseUrl: string) => Promise<T>,
): Promise<T> {
  const server: Server = createServer(app);
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => resolve());
  });

  const address = server.address();
  if (!address || typeof address === "string") {
    await closeServer(server);
    throw new Error("Test server did not expose an address");
  }

  try {
    return await callback(`http://127.0.0.1:${address.port}`);
  } finally {
    await closeServer(server);
  }
}

async function closeServer(server: Server): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
}

async function eventually<T>(read: () => Promise<T | undefined>): Promise<T> {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const value = await read();
    if (value !== undefined) return value;
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
  throw new Error("Timed out waiting for Telegram scout callback");
}

async function postScoutCallback(
  baseUrl: string,
  callbackId: string,
  data: string,
  chatId: number | string = TELEGRAM_CHAT_ID,
  webhookSecret: string | undefined = TELEGRAM_WEBHOOK_SECRET,
): Promise<void> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (webhookSecret) {
    headers["X-Telegram-Bot-Api-Secret-Token"] = webhookSecret;
  }
  const response = await fetch(`${baseUrl}/api/integrations/telegram-webhook`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      update_id: Number(callbackId.replace(/\D/g, "")) || 1,
      callback_query: {
        id: callbackId,
        data,
        message: {
          message_id: 900,
          chat: { id: chatId },
        },
      },
    }),
  });
  assert.equal(response.status, 200);
}

beforeEach(async () => {
  await db
    .delete(scoutJobsTable)
    .where(eq(scoutJobsTable.url, SCOUT_JOB_URL));
  await db
    .delete(opportunitiesTable)
    .where(eq(opportunitiesTable.url, SCOUT_JOB_URL));
  process.env.TELEGRAM_CHAT_ID = TELEGRAM_CHAT_ID;
  process.env.TELEGRAM_BOT_TOKEN = TELEGRAM_BOT_TOKEN;
  process.env.TELEGRAM_WEBHOOK_SECRET = TELEGRAM_WEBHOOK_SECRET;
});

afterEach(() => {
  delete process.env.TELEGRAM_CHAT_ID;
  delete process.env.TELEGRAM_BOT_TOKEN;
  delete process.env.TELEGRAM_WEBHOOK_SECRET;
});

describe("job scout Telegram alerts", () => {
  it("formats a safe HTML alert with the durable callback id", () => {
    const posting: ScoutPosting = {
      sourceId: "remoteok-123",
      source: "Remote OK",
      title: "<Marketing Lead>",
      company: "Example & Co",
      url: "https://example.com/jobs/123?ref=scout&team=web3",
      description: "Own ecosystem growth <with> a global team.",
      location: "Remote APAC",
      jobType: "full-time",
    };

    const text = formatScoutAlert(posting);

    assert.match(text, /Job Scout Match/);
    assert.match(text, /&lt;Marketing Lead&gt;/);
    assert.match(text, /Example &amp; Co/);
    assert.match(text, /href="https:\/\/example.com\/jobs\/123\?ref=scout&amp;team=web3"/);
    assert.doesNotMatch(text, /<Marketing Lead>/);
  });

  it("keeps Add, Ignore-after-Add, and unknown callbacks idempotent", async () => {
    const [job] = await db
      .insert(scoutJobsTable)
      .values({
        sourceId: "scout-123",
        source: "Test feed",
        title: "Senior Product Engineer",
        company: "Example & Co",
        url: SCOUT_JOB_URL,
        description: "Build useful things.",
        discoveredAt: new Date().toISOString(),
      })
      .returning({ id: scoutJobsTable.id });
    assert.ok(job);

    const calls: TelegramCall[] = [];
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async (input, init) => {
      const url =
        typeof input === "string"
          ? input
          : input instanceof URL
            ? input.href
            : input.url;
      if (!url.startsWith("https://api.telegram.org/")) {
        return originalFetch(input, init);
      }
      assert.match(
        url,
        new RegExp(`^https://api\\.telegram\\.org/bot${TELEGRAM_BOT_TOKEN}/`),
      );
      const method = url.slice(url.lastIndexOf("/") + 1);
      const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
      calls.push({ method, body });
      return new Response(
        JSON.stringify({ ok: true, result: method === "sendMessage" ? { message_id: 901 } : true }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }) as typeof fetch;

    try {
      const app = express();
      app.use(express.json());
      app.use("/api", createTelegramWebhookRouter());

      await withServer(app, async (baseUrl) => {
        await postScoutCallback(baseUrl, "add-1", `add_opp:${job.id}`);
        const addedJob = await eventually(async () => {
          const [row] = await db
            .select()
            .from(scoutJobsTable)
            .where(eq(scoutJobsTable.id, job.id));
          return row?.status === "added" ? row : undefined;
        });
        assert.equal(addedJob.status, "added");
        assert.ok(addedJob.opportunityId);

        const addedOpportunities = await db
          .select()
          .from(opportunitiesTable)
          .where(eq(opportunitiesTable.url, SCOUT_JOB_URL));
        assert.equal(addedOpportunities.length, 1);
        const firstEdit = calls.find((call) => call.method === "editMessageText");
        assert.ok(firstEdit);
        assert.equal(firstEdit.body.chat_id, TELEGRAM_CHAT_ID);
        assert.equal(firstEdit.body.message_id, 900);
        assert.deepEqual(firstEdit.body.reply_markup, { inline_keyboard: [] });
        assert.match(firstEdit.body.text as string, /Added to Dashboard/);

        await postScoutCallback(baseUrl, "add-2", `add_opp:${job.id}`);
        await eventually(async () =>
          calls.some(
            (call) =>
              call.method === "answerCallbackQuery" &&
              call.body.callback_query_id === "add-2",
          )
            ? true
            : undefined,
        );

        await postScoutCallback(baseUrl, "ignore-after-add", `ignore_opp:${job.id}`);
        await eventually(async () =>
          calls.some(
            (call) =>
              call.method === "answerCallbackQuery" &&
              call.body.callback_query_id === "ignore-after-add",
          )
            ? true
            : undefined,
        );

        const afterRetries = await db
          .select()
          .from(opportunitiesTable)
          .where(eq(opportunitiesTable.url, SCOUT_JOB_URL));
        const [jobAfterRetries] = await db
          .select()
          .from(scoutJobsTable)
          .where(eq(scoutJobsTable.id, job.id));
        assert.equal(afterRetries.length, 1);
        assert.equal(jobAfterRetries?.status, "added");
        assert.equal(jobAfterRetries?.opportunityId, addedJob.opportunityId);
        assert.match(
          calls
            .filter((call) => call.method === "editMessageText")
            .at(-1)?.body.text as string,
          /Added to Dashboard/,
        );

        await postScoutCallback(baseUrl, "unknown-1", "add_opp:999999999");
        await postScoutCallback(baseUrl, "unknown-2", "add_opp:999999999");
        await eventually(async () =>
          calls.filter(
            (call) =>
              call.method === "answerCallbackQuery" &&
              (call.body.callback_query_id === "unknown-1" ||
                call.body.callback_query_id === "unknown-2"),
          ).length === 2
            ? true
            : undefined,
        );
        assert.equal(
          calls.filter(
            (call) =>
              call.method === "answerCallbackQuery" &&
              call.body.text === "This job alert has expired.",
          ).length,
          2,
        );
      });
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("ignores scout callbacks from an untrusted chat", async () => {
    const [job] = await db
      .insert(scoutJobsTable)
      .values({
        sourceId: "untrusted-chat-scout-123",
        source: "Test feed",
        title: "Senior Product Engineer",
        company: "Example & Co",
        url: SCOUT_JOB_URL,
        description: "Build useful things.",
        discoveredAt: new Date().toISOString(),
      })
      .returning({ id: scoutJobsTable.id });
    assert.ok(job);

    const calls: TelegramCall[] = [];
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async (input, init) => {
      const url =
        typeof input === "string"
          ? input
          : input instanceof URL
            ? input.href
            : input.url;
      if (!url.startsWith("https://api.telegram.org/")) {
        return originalFetch(input, init);
      }
      const method = url.slice(url.lastIndexOf("/") + 1);
      const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
      calls.push({ method, body });
      return new Response(JSON.stringify({ ok: true, result: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }) as typeof fetch;

    try {
      const app = express();
      app.use(express.json());
      app.use("/api", createTelegramWebhookRouter());

      await withServer(app, async (baseUrl) => {
        await postScoutCallback(
          baseUrl,
          "untrusted-chat-1",
          `add_opp:${job.id}`,
          "another-chat",
          undefined,
        );

        const [jobAfterCallback] = await db
          .select()
          .from(scoutJobsTable)
          .where(eq(scoutJobsTable.id, job.id));
        const opportunities = await db
          .select()
          .from(opportunitiesTable)
          .where(eq(opportunitiesTable.url, SCOUT_JOB_URL));

        assert.equal(calls.length, 0);
        assert.equal(jobAfterCallback?.status, "pending");
        assert.equal(jobAfterCallback?.opportunityId, null);
        assert.equal(opportunities.length, 0);
      });
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});