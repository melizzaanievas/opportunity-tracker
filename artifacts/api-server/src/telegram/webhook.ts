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
    if (update?.message?.text) {
      const chatId = update.message.chat.id;
      const text = update.message.text.trim();

      if (text.startsWith("/start") || text.startsWith("/help")) {
        await sendTelegramMessage(
          "👋 <b>Welcome to Opportunity Tracker Bot!</b>\n\nI will send you daily updates and scout alerts for incoming opportunities.\n\nType /digest anytime to see your upcoming deadlines!",
          chatId
        );
      } else if (text.startsWith("/digest")) {
        const summary = await buildDailySummary();
        await sendTelegramMessage(summary.text, chatId);
      } else {
        await sendTelegramMessage(
          `Received: "${text}"\n\nType /digest to view upcoming deadlines.`,
          chatId
        );
      }
    }

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
