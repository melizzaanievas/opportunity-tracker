import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";
import { readFile } from "node:fs/promises";
import { afterEach, beforeEach, describe, it } from "node:test";
import express, { type Express } from "express";
import { eq } from "drizzle-orm";
import { db, opportunitiesTable } from "../src/db/index.ts";
import { createOpportunitiesRouter } from "../src/routes/opportunities.ts";
import { createTelegramWebhookRouter } from "../src/routes/telegram-webhook.ts";
import { parseScrapedHtml } from "../src/lib/scraper.ts";

const TELEGRAM_CHAT_ID = "save-flow-test-chat";
const TELEGRAM_URL = "https://www.linkedin.com/jobs/view/123456789";

async function fixture(name: string): Promise<string> {
  return readFile(new URL(`./fixtures/${name}`, import.meta.url), "utf8");
}

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

function authenticatedApp(router: Parameters<Express["use"]>[0]): Express {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    Object.assign(req, { session: { authenticated: true } });
    next();
  });
  app.use(router);
  return app;
}

async function eventually<T>(read: () => Promise<T | undefined>): Promise<T> {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const value = await read();
    if (value !== undefined) return value;
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
  throw new Error("Timed out waiting for Telegram opportunity to be inserted");
}

async function removeTelegramTestRows(): Promise<void> {
  await db
    .delete(opportunitiesTable)
    .where(eq(opportunitiesTable.url, TELEGRAM_URL));
}

beforeEach(async () => {
  await removeTelegramTestRows();
});

afterEach(async () => {
  await removeTelegramTestRows();
  delete process.env.TELEGRAM_CHAT_ID;
});

describe("save-flow metadata wiring", () => {
  it("returns normalized provider titles and blank boilerplate summaries from the add-form scrape endpoint", async () => {
    const cases = [
      ["linkedin-generic.html", "LinkedIn Job 123456789"],
      ["airtable-generic.html", "Airtable Base appABC123"],
    ] as const;

    for (const [filename, expectedTitle] of cases) {
      const url =
        filename === "airtable-generic.html"
          ? "https://airtable.com/appABC123"
          : TELEGRAM_URL;
      const scraped = parseScrapedHtml(url, await fixture(filename));
      const app = authenticatedApp(
        createOpportunitiesRouter({
          scrapeUrl: async () => scraped,
        }),
      );

      await withServer(app, async (baseUrl) => {
        const response = await fetch(`${baseUrl}/opportunities/scrape`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url }),
        });
        const body = (await response.json()) as {
          title: string | null;
          summary: string | null;
        };

        assert.equal(response.status, 200);
        assert.equal(body.title, expectedTitle);
        assert.equal(body.summary, null);
      });
    }
  });

  it("stores the normalized title and blank summary when Telegram saves a link", async () => {
    process.env.TELEGRAM_CHAT_ID = TELEGRAM_CHAT_ID;
    const scraped = parseScrapedHtml(
      TELEGRAM_URL,
      await fixture("linkedin-generic.html"),
    );
    const replies: Array<{
      chatId: number | string;
      text: string;
      replyToMessageId?: number;
    }> = [];
    const app = authenticatedApp(
      createTelegramWebhookRouter({
        validateScrapeUrl: async (url) => new URL(url),
        scrapeUrl: async () => scraped,
        sendReply: async (chatId, text, replyToMessageId) => {
          replies.push({ chatId, text, replyToMessageId });
        },
      }),
    );

    await withServer(app, async (baseUrl) => {
      const response = await fetch(`${baseUrl}/telegram-webhook`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          update_id: 1,
          message: {
            message_id: 42,
            chat: { id: TELEGRAM_CHAT_ID },
            text: TELEGRAM_URL,
          },
        }),
      });

      assert.equal(response.status, 200);

      const inserted = await eventually(async () => {
        const [row] = await db
          .select({
            title: opportunitiesTable.title,
            summary: opportunitiesTable.summary,
          })
          .from(opportunitiesTable)
          .where(eq(opportunitiesTable.url, TELEGRAM_URL));
        return row;
      });

      assert.deepEqual(inserted, {
        title: "LinkedIn Job 123456789",
        summary: null,
      });
      await eventually(async () =>
        replies.length === 1 ? replies : undefined,
      );
      assert.equal(replies.length, 1);
      assert.equal(replies[0]?.chatId, TELEGRAM_CHAT_ID);
      assert.equal(replies[0]?.replyToMessageId, 42);
    });
  });

  it("ignores valid URLs from an unauthorized Telegram chat", async () => {
    process.env.TELEGRAM_CHAT_ID = TELEGRAM_CHAT_ID;
    let validateCalls = 0;
    let scrapeCalls = 0;
    let replyCalls = 0;
    const app = authenticatedApp(
      createTelegramWebhookRouter({
        validateScrapeUrl: async (url) => {
          validateCalls += 1;
          return new URL(url);
        },
        scrapeUrl: async () => {
          scrapeCalls += 1;
          throw new Error("Scraper should not be called");
        },
        sendReply: async () => {
          replyCalls += 1;
        },
      }),
    );

    await withServer(app, async (baseUrl) => {
      const response = await fetch(`${baseUrl}/telegram-webhook`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          update_id: 2,
          message: {
            message_id: 43,
            chat: { id: "unauthorized-chat" },
            text: `Please save this opportunity: ${TELEGRAM_URL}`,
          },
        }),
      });

      assert.equal(response.status, 200);
      assert.equal(validateCalls, 0);
      assert.equal(scrapeCalls, 0);
      assert.equal(replyCalls, 0);

      const [inserted] = await db
        .select({ id: opportunitiesTable.id })
        .from(opportunitiesTable)
        .where(eq(opportunitiesTable.url, TELEGRAM_URL));
      assert.equal(inserted, undefined);
    });
  });
});
