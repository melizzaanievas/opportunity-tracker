import { Request, Response } from "express";
import { 
  sendTelegramMessage, 
  buildDailySummary, 
  answerTelegramCallbackQuery, 
  editTelegramMessage 
} from "../lib/telegram";

export async function handleTelegramWebhook(req: Request, res: Response) {
  const secretToken = req.headers["x-telegram-bot-api-secret-token"];

  if (
    process.env.TELEGRAM_WEBHOOK_SECRET &&
    secretToken !== process.env.TELEGRAM_WEBHOOK_SECRET
  ) {
    res.status(403).json({ error: "Unauthorized webhook request" });
    return;
  }

  const update = req.body;
  console.log("Received Telegram Update:", JSON.stringify(update));

  try {
    // 1. Handle incoming chat messages (like /start or /digest)
    if (update?.message?.text) {
      const text = update.message.text.trim();

      if (text.startsWith("/start") || text.startsWith("/help")) {
        await sendTelegramMessage(
          "👋 <b>Welcome to Opportunity Tracker Bot!</b>\n\nI will send you daily updates and scout alerts for incoming opportunities.\n\nType /digest anytime to see your upcoming deadlines!"
        );
      } else if (text.startsWith("/digest")) {
        const summary = await buildDailySummary();
        await sendTelegramMessage(summary.text);
      } else {
        await sendTelegramMessage(
          `Received: "${text}"\n\nType /digest to view upcoming deadlines.`
        );
      }
    }

    // 2. Handle button clicks on scout messages (inline keyboard callbacks)
    if (update?.callback_query) {
      const callback = update.callback_query;
      await answerTelegramCallbackQuery(callback.id, "Processing your choice...");

      if (callback.message) {
        await editTelegramMessage(
          callback.message.chat.id,
          callback.message.message_id,
          `${callback.message.text}\n\n✅ <i>Action recorded.</i>`
        );
      }
    }
  } catch (err) {
    console.error("Error processing Telegram update:", err);
  }

  res.status(200).json({ status: "ok" });
  return;
}
