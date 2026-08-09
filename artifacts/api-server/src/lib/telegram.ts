import { logger } from "./logger";
import { db, opportunitiesTable } from "../db";
import { gte, lte, and, ne } from "drizzle-orm";
import { buildGoogleCalendarUrl } from "./google-calendar-link";

const TELEGRAM_API = "https://api.telegram.org";

export async function sendTelegramMessage(text: string): Promise<boolean> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (!token || !chatId) {
    logger.warn("Telegram credentials not configured");
    return false;
  }

  try {
    const res = await fetch(`${TELEGRAM_API}/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: "HTML",
      }),
    });

    const data = await res.json() as { ok: boolean; description?: string };
    if (!data.ok) {
      logger.error({ description: data.description }, "Telegram API error");
      return false;
    }
    return true;
  } catch (err) {
    logger.error({ err }, "Failed to send Telegram message");
    return false;
  }
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
        ne(opportunitiesTable.status, "completed")
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
    return `${urgency} <b>${opp.title}</b>\n   📅 ${deadline}${daysText} | 📌 ${opp.type} | ${opp.status}\n   🔗 ${opp.url}\n   ${calendarLink}`;
  });

  const text = `🎯 <b>Opportunity Tracker Daily Digest</b>\n<i>${closing.length} deadline(s) in the next 7 days</i>\n\n${lines.join("\n\n")}`;

  return { text, count: closing.length };
}
