import { Router, type IRouter } from "express";
import { db, opportunitiesTable } from "../db";
import { scrapeUrl, validateScrapeUrl } from "../lib/scraper";
import { logger } from "../lib/logger";
import { buildGoogleCalendarUrl } from "../lib/google-calendar-link";

const router: IRouter = Router();

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
}

async function sendReply(chatId: number | string, text: string, replyToMessageId?: number): Promise<void> {
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
    const title = scraped.title ?? new URL(url).hostname;

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
});

export default router;
