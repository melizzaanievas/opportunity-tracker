import { Request, Response } from "express";
import { handleTelegramUpdate } from "../lib/telegram";

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
    if (update) {
      await handleTelegramUpdate(update);
    }
  } catch (err) {
    console.error("Error handling Telegram update:", err);
  }

  res.status(200).json({ status: "ok" });
  return;
}
