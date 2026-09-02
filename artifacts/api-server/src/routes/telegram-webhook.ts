import { Router, type IRouter, type Request, type Response } from "express";
import { eq } from "drizzle-orm";
import { db, opportunitiesTable, scoutJobsTable } from "../db";
import {
  cleanupTitle,
  resolveOpportunityTitle,
  scrapeUrl,
  validateScrapeUrl,
} from "../lib/scraper";
import { logger } from "../lib/logger";
import { buildGoogleCalendarUrl } from "../lib/google-calendar-link";
import {
  answerTelegramCallbackQuery,
  editTelegramMessage,
  escapeTelegramHtml,
} from "../lib/telegram";

/* ── helpers ── */

const URL_REGEX = /https?:\/\/[^\s<>"]+/i;

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

export function createTelegramWebhookRouter(
  dependencies: {
    validateScrapeUrl?: typeof validateScrapeUrl;
    scrapeUrl?: typeof scrapeUrl;
    sendReply?: typeof sendReply;
  } = {},
): IRouter {
  const router: IRouter = Router();
  const validate = dependencies.validateScrapeUrl ?? validateScrapeUrl;
  const scrape = dependencies.scrapeUrl ?? scrapeUrl;
  const reply = dependencies.sendReply ?? sendReply;

  /* ── Webhook endpoint (no session auth — called by Telegram's servers) ── */
  router.post("/telegram-webhook", async (req, res): Promise<void> => {
    // Always acknowledge immediately — Telegram retries on non-200
    res.sendStatus(200);

    const update = req.body as TelegramUpdate;
    const message = update?.message;
    if (!message?.text) return;

    const configuredChatId = process.env.TELEGRAM_CHAT_ID;
    const incomingChatId = String(message.chat.id);

    // Security: only process messages from the configured chat
    if (!configuredChatId || incomingChatId !== String(configuredChatId)) {
      logger.warn(
        { incomingChatId, configuredChatId },
        "Telegram webhook: message from unknown chat — ignored",
      );
      return;
    }

    const text = message.text.trim();
    const urlMatch = URL_REGEX.exec(text);
    if (!urlMatch) {
      // Not a URL — ignore silently (could be a command or plain text)
      return;
    }

    const url = urlMatch[0];
    const chatId = message.chat.id;
    const messageId = message.message_id;

    logger.info({ url }, "Telegram webhook: URL detected, scraping…");

    try {
      // 1. Scrape the URL
      await validate(url);
      const scraped = await scrape(url);
      const userTitle = cleanupTitle(text.replace(url, " "));
      const title =
        userTitle ??
        resolveOpportunityTitle(url, scraped.title, scraped.deadline);

      // 2. Insert into DB
      const [inserted] = await db
        .insert(opportunitiesTable)
        .values({
          url,
          title,
          type: "other",
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

      logger.info(
        { id: inserted.id, title: inserted.title },
        "Telegram webhook: opportunity saved",
      );

      // 3. Reply to the user
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
  });

  return router;
}

async function handleScoutCallback(
  callbackQuery: NonNullable<TelegramUpdate["callback_query"]>,
  configuredChatId: string,
): Promise<void> {
  const callbackMessage = callbackQuery.message;
  if (
    !callbackMessage ||
    String(callbackMessage.chat.id) !== configuredChatId ||
    !callbackQuery.data
  ) {
    return;
  }

  const match = /^(add_opp|ignore_opp):(\d+)$/.exec(callbackQuery.data);
  if (!match) {
    await answerTelegramCallbackQuery(callbackQuery.id, "Unknown scout action.");
    return;
  }

  const action = match[1];
  const jobId = Number(match[2]);
  const [job] = await db
    .select()
    .from(scoutJobsTable)
    .where(eq(scoutJobsTable.id, jobId));

  if (!job) {
    await answerTelegramCallbackQuery(callbackQuery.id, "This job alert has expired.");
    return;
  }

  if (action === "ignore_opp") {
    if (job.status === "added") {
      await editTelegramMessage(
        callbackMessage.chat.id,
        callbackMessage.message_id,
        `✅ <b>Added to Dashboard</b>\n\n${escapeTelegramHtml(job.title)}`,
      );
      await answerTelegramCallbackQuery(callbackQuery.id, "This job is already in your dashboard.");
      return;
    }
    if (job.status === "ignored") {
      await editTelegramMessage(
        callbackMessage.chat.id,
        callbackMessage.message_id,
        `❌ <b>Ignored</b>\n\n${escapeTelegramHtml(job.title)}`,
      );
      await answerTelegramCallbackQuery(callbackQuery.id, "Already ignored.");
      return;
    }
    if (job.status === "pending") {
      await db
        .update(scoutJobsTable)
        .set({ status: "ignored" })
        .where(eq(scoutJobsTable.id, job.id));
    }
    await editTelegramMessage(
      callbackMessage.chat.id,
      callbackMessage.message_id,
      `❌ <b>Ignored</b>\n\n${escapeTelegramHtml(job.title)}`,
    );
    await answerTelegramCallbackQuery(callbackQuery.id, "Ignored.");
    return;
  }

  if (job.status === "ignored") {
    await answerTelegramCallbackQuery(callbackQuery.id, "This job was already ignored.");
    return;
  }

  if (job.status === "added" && job.opportunityId) {
    await editTelegramMessage(
      callbackMessage.chat.id,
      callbackMessage.message_id,
      `✅ <b>Added to Dashboard</b>\n\n${escapeTelegramHtml(job.title)}`,
    );
    await answerTelegramCallbackQuery(callbackQuery.id, "Already in your dashboard.");
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
    await answerTelegramCallbackQuery(callbackQuery.id, "Could not add this job.");
    return;
  }

  await db
    .update(scoutJobsTable)
    .set({ status: "added", opportunityId })
    .where(eq(scoutJobsTable.id, job.id));

  const company = job.company
    ? `\n🏢 ${escapeTelegramHtml(job.company)}`
    : "";
  await editTelegramMessage(
    callbackMessage.chat.id,
    callbackMessage.message_id,
    `✅ <b>Added to Dashboard</b>\n\n<b>${escapeTelegramHtml(job.title)}</b>${company}`,
  );
  await answerTelegramCallbackQuery(callbackQuery.id, "Added to your dashboard.");
}

/* ── Webhook endpoint (no session auth — called by Telegram's servers) ── */
async function handleTelegramUpdate(req: Request, res: Response): Promise<void> {
  // Always acknowledge immediately — Telegram retries on non-200
  res.sendStatus(200);

  const update = req.body as TelegramUpdate;
  const configuredChatId = process.env.TELEGRAM_CHAT_ID;
  if (!configuredChatId) return;

  if (update?.callback_query) {
    await handleScoutCallback(update.callback_query, String(configuredChatId));
    return;
  }

  const message = update?.message;
  if (!message?.text) return;

  const incomingChatId = String(message.chat.id);

  // Security: only process messages from the configured chat
  if (!configuredChatId || incomingChatId !== String(configuredChatId)) {
    logger.warn({ incomingChatId, configuredChatId }, "Telegram webhook: message from unknown chat — ignored");
    return;
  }

  const text = message.text.trim();
  const urlMatch = URL_REGEX.exec(text);
  if (!urlMatch) {
    // Not a URL — ignore silently (could be a command or plain text)
    return;
  }

  const url = urlMatch[0];
  const chatId = message.chat.id;
  const messageId = message.message_id;

  logger.info({ url }, "Telegram webhook: URL detected, scraping…");

  try {
    // 1. Scrape the URL
    await validateScrapeUrl(url);
    const scraped = await scrapeUrl(url);
    const userTitle = cleanupTitle(text.replace(url, " "));
    const title =
      userTitle ?? resolveOpportunityTitle(url, scraped.title, scraped.deadline);

    // 2. Insert into DB
    const [inserted] = await db
      .insert(opportunitiesTable)
      .values({
        url,
        title,
        type: "other",
        status: "to-apply",
        deadline: scraped.deadline ?? null,
        summary: scraped.summary ?? null,
        keyActionSteps: scraped.keyActionSteps ?? null,
        createdAt: new Date().toISOString(),
      })
      .returning({ id: opportunitiesTable.id, title: opportunitiesTable.title, deadline: opportunitiesTable.deadline });

    logger.info({ id: inserted.id, title: inserted.title }, "Telegram webhook: opportunity saved");

    // 3. Reply to the user
    const deadlineText = inserted.deadline ? `\n📅 Deadline: <b>${inserted.deadline}</b>` : "";
    const googleCalUrl = buildGoogleCalendarUrl({
      title: inserted.title,
      deadline: inserted.deadline,
      summary: scraped.summary,
      url,
    });
    const calendarLink = `<a href="${googleCalUrl}">📅 Add to Google Calendar</a>`;
    const replyText = `✅ <b>Opportunity saved!</b>\n\n📌 <b>${inserted.title}</b>${deadlineText}\n\n${calendarLink}\n\n<i>Open your dashboard to view and add tasks.</i>`;
    await sendReply(chatId, replyText, messageId);
  } catch (err) {
    logger.error({ err, url }, "Telegram webhook: failed to save opportunity");
    await sendReply(
      chatId,
      `⚠️ Could not save that link. The page may be inaccessible or require login.\n\n<code>${url}</code>`,
      messageId
    );
  }
}

router.post("/telegram-webhook", handleTelegramUpdate);
router.post("/integrations/telegram-webhook", handleTelegramUpdate);
