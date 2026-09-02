import { Request, Response } from "express";

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
  console.log("Received Telegram Update:", update);

  res.status(200).json({ status: "ok" });
  return;
}
