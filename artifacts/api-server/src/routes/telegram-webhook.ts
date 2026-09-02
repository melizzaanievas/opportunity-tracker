import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, opportunitiesTable, scoutJobsTable } from "../db";
import {
  cleanupTitle,
  resolveOpportunityTitle,
  scrapeUrl,
  validateScrapeUrl,
} from "../lib/scraper";
import { insertInitialActionPlanTasks } from "../lib/action-plan";
import { logger } from "../lib/logger";
import { buildGoogleCalendarUrl } from "../lib/google-calendar-link";
import {
  answerTelegramCallbackQuery,
  editTelegramMessage,
  escapeTelegramHtml,
  getTelegramWebhookSecret,
} from "../lib/telegram";

const URL_REGEX = /https?:\/\/[^\s<>"]+/i;
const TELEGRAM_WEBHOOK_SECRET_HEADER = "x-telegram-bot-api-secret-token";

interface TelegramUpdate {
  update_id: number;
  message?: {
    message_id: number;
    chat: { id: number | string };
    from?: { id: number | string; first_name?: string; username?: string };
    text?: string;
  };
  callback_query?: {
    id: string;
    data?: string;
    message?: {
      message_id: number;
      chat: { id: number | string };
    };
  };
}

type SendReply = (
  chatId: number | string,
  text: string,
  replyToMessageId?: number,
) => Promise<void>;

type TelegramWebhookRequest = {
  body: unknown;
  headers?: Record<string, string | string[] | undefined>;
};

type TelegramWebhookResponse = {
  sendStatus: (statusCode: number) => unknown;
};

interface TelegramWebhookDependencies {
  validateScrapeUrl?: typeof validateScrapeUrl;
  scrapeUrl?: typeof scrapeUrl;
  sendReply?: SendReply;
  editTelegramMessage?: typeof editTelegramMessage;
  answerTelegramCallbackQuery?: typeof answerTelegramCallbackQuery;
}

async function sendReply(
  chatId: number | string,
  text: string,
  replyToMessageId?: number,
): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return;

  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: "HTML",
        ...(replyToMessageId ? { reply_to_message_id: replyToMessageId } : {}),
      }),
    });
  } catch (err) {
    logger.error({ err }, "Failed to send Telegram reply");
  }
}

async function handleScoutCallback(
  callbackQuery: NonNullable<TelegramUpdate["callback_query"]>,
  configuredChatId: string,
  dependencies: Pick<
    TelegramWebhookDependencies,
    "editTelegramMessage" | "answerTelegramCallbackQuery"
  >,
): Promise<void> {
  const callbackMessage = callbackQuery.message;
  if (
    !callbackMessage ||
    String(callbackMessage.chat.id) !== configuredChatId ||
    !callbackQuery.data
  ) {
    return;
  }

  const answer = dependencies.answerTelegramCallbackQuery ?? answerTelegramCallbackQuery;
  const edit = dependencies.editTelegramMessage ?? editTelegramMessage;
  const match = /^(add_opp|ignore_opp):(\d+)$/.exec(callbackQuery.data);
  if (!match) {
    await answer(callbackQuery.id, "Unknown scout action.");
    return;
  }

  const action = match[1];
  const jobId = Number(match[2]);
  const [job] = await db
    .select()
    .from(scoutJobsTable)
    .where(eq(scoutJobsTable.id, jobId));

  if (!job) {
    await answer(callbackQuery.id, "This job alert has expired.");
    return;
  }

  if (action === "ignore_opp") {
    if (job.status === "added") {
      await edit(
        callbackMessage.chat.id,
        callbackMessage.message_id,
        `✅ <b>Added to Dashboard</b>\n\n${escapeTelegramHtml(job.title)}`,
      );
      await answer(callbackQuery.id, "This job is already in your dashboard.");
      return;
    }
    if (job.status === "ignored") {
      await edit(
        callbackMessage.chat.id,
        callbackMessage.message_id,
        `❌ <b>Ignored</b>\n\n${escapeTelegramHtml(job.title)}`,
      );
      await answer(callbackQuery.id, "Already ignored.");
      return;
    }
    if (job.status === "pending") {
      await db
        .update(scoutJobsTable)
        .set({ status: "ignored" })
        .where(eq(scoutJobsTable.id, job.id));
    }
    await edit(
      callbackMessage.chat.id,
      callbackMessage.message_id,
      `❌ <b>Ignored</b>\n\n${escapeTelegramHtml(job.title)}`,
    );
    await answer(callbackQuery.id, "Ignored.");
    return;
  }

  if (job.status === "ignored") {
    await answer(callbackQuery.id, "This job was already ignored.");
    return;
  }

  if (job.status === "added" && job.opportunityId) {
    await edit(
      callbackMessage.chat.id,
      callbackMessage.message_id,
      `✅ <b>Added to Dashboard</b>\n\n${escapeTelegramHtml(job.title)}`,
    );
    await answer(callbackQuery.id, "Already in your dashboard.");
    return;
  }

  const [existing] = await db
    .select()
    .from(opportunitiesTable)
    .where(eq(opportunitiesTable.url, job.url));

  let opportunityId = existing?.id;
  if (!existing) {
    const [inserted] = await db
      .insert(opportunitiesTable)
      .values({
        url: job.url,
        title: job.title,
        company: job.company,
        type: "job",
        status: "to-apply",
        summary: job.description,
        createdAt: new Date().toISOString(),
      })
      .returning({ id: opportunitiesTable.id });
    opportunityId = inserted?.id;
  }

  if (!opportunityId) {
    await answer(callbackQuery.id, "Could not add this job.");
    return;
  }

  await db
    .update(scoutJobsTable)
    .set({ status: "added", opportunityId })
    .where(eq(scoutJobsTable.id, job.id));

  const company = job.company
    ? `\n🏢 ${escapeTelegramHtml(job.company)}`
    : "";
  await edit(
    callbackMessage.chat.id,
    callbackMessage.message_id,
    `✅ <b>Added to Dashboard</b>\n\n<b>${escapeTelegramHtml(job.title)}</b>${company}`,
  );
  await answer(callbackQuery.id, "Added to your dashboard.");
}

export function createTelegramWebhookRouter(
  dependencies: TelegramWebhookDependencies = {},
): IRouter {
  const router: IRouter = Router();
  const validate = dependencies.validateScrapeUrl ?? validateScrapeUrl;
  const scrape = dependencies.scrapeUrl ?? scrapeUrl;
  const reply = dependencies.sendReply ?? sendReply;

  async function handleTelegramUpdate(
    req: TelegramWebhookRequest,
    res: TelegramWebhookResponse,
  ): Promise<void> {
    const configuredWebhookSecret = getTelegramWebhookSecret();
    const receivedWebhookSecret = req.headers?.[TELEGRAM_WEBHOOK_SECRET_HEADER];
    if (
      !configuredWebhookSecret ||
      typeof receivedWebhookSecret !== "string" ||
      receivedWebhookSecret !== configuredWebhookSecret
    ) {
      res.sendStatus(401);
      return;
    }

    // Always acknowledge immediately — Telegram retries on non-200.
    res.sendStatus(200);

    const update = req.body as TelegramUpdate;
    const configuredChatId = process.env.TELEGRAM_CHAT_ID;
    if (!configuredChatId) return;

    if (update?.callback_query) {
      await handleScoutCallback(update.callback_query, String(configuredChatId), dependencies);
      return;
    }

    const message = update?.message;
    if (!message?.text) return;

    const incomingChatId = String(message.chat.id);

    // Security: only process messages from the configured chat.
    if (incomingChatId !== String(configuredChatId)) {
      logger.warn(
        { incomingChatId, configuredChatId },
        "Telegram webhook: message from unknown chat — ignored",
      );
      return;
    }

    const text = message.text.trim();
    const urlMatch = URL_REGEX.exec(text);
    if (!urlMatch) return;

    const url = urlMatch[0];
    const chatId = message.chat.id;
    const messageId = message.message_id;

    logger.info({ url }, "Telegram webhook: URL detected, scraping…");

    try {
      await validate(url);
      const scraped = await scrape(url);
      const userTitle = cleanupTitle(text.replace(url, " "));
      const title =
        userTitle ??
        resolveOpportunityTitle(url, scraped.title, scraped.deadline);

      const [inserted] = await db
        .insert(opportunitiesTable)
        .values({
          url,
          title,
          type: scraped.type,
          status: "to-apply",
          deadline: scraped.deadline ?? null,
          summary: scraped.summary ?? null,
          keyActionSteps: scraped.keyActionSteps ?? null,
          createdAt: new Date().toISOString(),
        })
        .returning({
          id: opportunitiesTable.id,
          title: opportunitiesTable.title,
          deadline: opportunitiesTable.deadline,
        });
      await insertInitialActionPlanTasks(
        inserted.id,
        scraped.type,
        scraped.actionPlanTasks,
      );

      logger.info(
        { id: inserted.id, title: inserted.title },
        "Telegram webhook: opportunity saved",
      );

      const deadlineText = inserted.deadline
        ? `\n📅 Deadline: <b>${inserted.deadline}</b>`
        : "";
      const googleCalUrl = buildGoogleCalendarUrl({
        title: inserted.title,
        deadline: inserted.deadline,
        summary: scraped.summary,
        url,
      });
      const calendarLink = `<a href="${googleCalUrl}">📅 Add to Google Calendar</a>`;
      const replyText = `✅ <b>Opportunity saved!</b>\n\n📌 <b>${inserted.title}</b>${deadlineText}\n\n${calendarLink}\n\n<i>Open your dashboard to view and add tasks.</i>`;
      await reply(chatId, replyText, messageId);
    } catch (err) {
      logger.error(
        { err, url },
        "Telegram webhook: failed to save opportunity",
      );
      await reply(
        chatId,
        `⚠️ Could not save that link. The page may be inaccessible or require login.\n\n<code>${url}</code>`,
        messageId,
      );
    }
  }

  router.post("/telegram-webhook", handleTelegramUpdate);
  router.post("/telegram/webhook", handleTelegramUpdate);
  router.post("/integrations/telegram-webhook", handleTelegramUpdate);
  return router;
}

export default createTelegramWebhookRouter();