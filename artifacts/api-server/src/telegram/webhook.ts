import { Request, Response } from 'express';

export async function registerTelegramWebhook() {
  const webhookUrl = process.env.RAILWAY_PUBLIC_DOMAIN 
    ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}/api/telegram/webhook`
    : null;

  if (!webhookUrl || !process.env.TELEGRAM_BOT_TOKEN) {
    console.log('Skipping Telegram webhook registration (missing URL or token).');
    return;
  }

  try {
    const response = await fetch(
      `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/setWebhook`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: webhookUrl,
          secret_token: process.env.TELEGRAM_WEBHOOK_SECRET,
        }),
      }
    );
    const data = await response.json();
    console.log('Telegram Webhook Registration Result:', data);
  } catch (error) {
    console.error('Failed to register Telegram webhook:', error);
  }
}

export async function handleTelegramWebhook(req: Request, res: Response) {
  const secretToken = req.headers['x-telegram-bot-api-secret-token'];
  
  if (process.env.TELEGRAM_WEBHOOK_SECRET && secretToken !== process.env.TELEGRAM_WEBHOOK_SECRET) {
    return res.status(403).json({ error: 'Unauthorized webhook request' });
  }

  const update = req.body;
  console.log('Received Telegram Update:', update);

  // Send immediate 200 OK to Telegram
  res.status(200).json({ status: 'ok' });
}
