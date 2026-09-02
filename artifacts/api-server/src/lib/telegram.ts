import { logger } from "./logger";
import { db, opportunitiesTable } from "../db";
import { gte, lte, and, ne } from "drizzle-orm";
import { buildGoogleCalendarUrl } from "./google-calendar-link";

const TELEGRAM_API = "https://api.telegram.org";
const LOCAL_TELEGRAM_WEBHOOK_SECRET = "local-development-webhook-secret";

/**
 * Default search terms for automated daily scouting.
 */
export const DEFAULT_SCOUT_QUERIES = [
  "Web3 Marketing Lead",
  "Blockchain Ecosystem Development",
  "Government Relations",
  "Public Policy",
  "APAC GTM",
  "Web3 GTM",
  "GTM Lead",
  "Policy Fellowship",
  "United Nations",
  "Web3 Growth Director",
  "AI Fellowship 2026",
];

/**
 * Keep local webhook checks usable without weakening production validation.
 */
export function getTelegramWebhookSecret(): string | undefined {
  const configuredSecret = process.env.TELEGRAM_WEBHOOK_SECRET?.trim();
  if (configuredSecret) return configuredSecret;

  return process.env.NODE_ENV === "production"
    ? undefined
    : LOCAL_TELEGRAM_WEBHOOK_SECRET;
}

export function escapeTelegramHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

async function telegramRequest<T>(
  method: string,
  body: Record<string, unknown>,
): Promise<T | null> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    logger.warn("Telegram credentials not configured");
    return null;
  }

  try {
    const res = await fetch(`${TELEGRAM_API}/bot${token}/${method}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = (await res.json()) as {
      ok: boolean;
      result?: T;
      description?: string;
    };
    if (!data.ok) {
      logger.error({ method, description: data.description }, "Telegram API error");
      return null;
    }
    return data.result ?? null;
  } catch (err) {
    logger.error({ err, method }, "Telegram API request failed");
    return null;
  }
}

export async function sendTelegramMessage(text: string): Promise<boolean> {
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (!chatId) {
    logger.warn("Telegram credentials not configured");
    return false;
  }

  return (
    (await telegramRequest("sendMessage", {
      chat_id: chatId,
      text,
      parse_mode: "HTML",
      disable_web_page_preview: true,
    })) !== null
  );
}

export async function sendScoutTelegramMessage(
  text: string,
  jobId: number,
): Promise<number | null> {
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!chatId) {
    logger.warn("Telegram credentials not configured");
    return null;
  }

  const result = await telegramRequest<{ message_id: number }>("sendMessage", {
    chat_id: chatId,
    text,
    parse_mode: "HTML",
    disable_web_page_preview: true,
    reply_markup: {
      inline_keyboard: [
        [
          { text: "➕ Add to Tracker", callback_data: `add_opp:${jobId}` },
          { text: "❌ Ignore", callback_data: `ignore_opp:${jobId}` },
        ],
      ],
    },
  });
  return result?.message_id ?? null;
}

export async function editTelegramMessage(
  chatId: number | string,
  messageId: number,
  text: string,
): Promise<boolean> {
  return (
    (await telegramRequest("editMessageText", {
      chat_id: chatId,
      message_id: messageId,
      text,
      parse_mode: "HTML",
      disable_web_page_preview: true,
      reply_markup: { inline_keyboard: [] },
    })) !== null
  );
}

export async function answerTelegramCallbackQuery(
  callbackQueryId: string,
  text: string,
): Promise<boolean> {
  return (
    (await telegramRequest("answerCallbackQuery", {
      callback_query_id: callbackQueryId,
      text,
    })) !== null
  );
}

export async function buildDailySummary(): Promise<{ text: string; count: number }> {
  const now = new Date();
  const sevenDaysLater = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  const todayStr = now.toISOString().slice(0, 10);
  const sevenDaysStr = sevenDaysLater.toISOString().slice(0, 10);

  const closing = await db
    .select()
    .from(opportunitiesTable)
    .where(
      and(
        gte(opportunitiesTable.deadline, todayStr),
        lte(opportunitiesTable.deadline, sevenDaysStr),
        ne(opportunitiesTable.status, "archived")
      )
    );

  if (closing.length === 0) {
    return {
      text: "🎯 <b>Opportunity Tracker Daily Digest</b>\n\nNo deadlines approaching in the next 7 days. Keep going!",
      count: 0,
    };
  }

  const sorted = closing.sort((a, b) => {
    if (!a.deadline) return 1;
    if (!b.deadline) return -1;
    return a.deadline.localeCompare(b.deadline);
  });

  const lines = sorted.map((opp) => {
    const daysLeft = opp.deadline
      ? Math.ceil((new Date(opp.deadline).getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
      : null;
    const urgency = daysLeft !== null && daysLeft <= 2 ? "🔴" : daysLeft !== null && daysLeft <= 4 ? "🟡" : "🟢";
    const deadline = opp.deadline ?? "No deadline";
    const daysText = daysLeft !== null ? ` (${daysLeft}d left)` : "";
    const googleCalUrl = buildGoogleCalendarUrl({
      title: opp.title,
      deadline: opp.deadline,
      summary: opp.summary,
      url: opp.url,
    });
    const calendarLink = `<a href="${googleCalUrl}">📅 Add to Google Calendar</a>`;
    return `${urgency} <b>${escapeTelegramHtml(opp.title)}</b>\n   📅 ${deadline}${daysText} | 📌 ${escapeTelegramHtml(opp.type)} | ${escapeTelegramHtml(opp.status)}\n   🔗 ${opp.url}\n   ${calendarLink}`;
  });

  const text = `🎯 <b>Opportunity Tracker Daily Digest</b>\n<i>${closing.length} deadline(s) in the next 7 days</i>\n\n${lines.join("\n\n")}`;

  return { text, count: closing.length };
}
