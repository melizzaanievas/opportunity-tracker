import path from "path";
import express from "express";
import app from "./app";
import { logger } from "./lib/logger";
import { startCronJobs } from "./lib/cron";
import { registerTelegramWebhook } from "./lib/register-webhook";
import { handleTelegramWebhook } from "./telegram/webhook";

// 1. Serve static frontend files from Vite build output
const staticPath = path.resolve(__dirname, "../../opportunity-tracker/dist/public");
app.use(express.static(staticPath));

// Register the Telegram Webhook handler endpoint
app.post("/api/telegram/webhook", handleTelegramWebhook);

// 2. Fallback route: serve index.html for React SPA routing (for any non-API request)
app.get("*", (req, res, next) => {
  if (req.path.startsWith("/api")) return next();
  res.sendFile(path.join(staticPath, "index.html"));
});

const rawPort = process.env.PORT;

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");
  startCronJobs();
  
  setTimeout(() => {
    void registerTelegramWebhook().catch((err: unknown) => {
      logger.error(
        { err },
        "Telegram webhook registration failed; server will continue running",
      );
    });
  }, 3000);
});
