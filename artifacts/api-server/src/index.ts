import app from "./app";
import { logger } from "./lib/logger";
import { startCronJobs } from "./lib/cron";
import { registerTelegramWebhook } from "./lib/register-webhook";

const rawPort = process.env["PORT"];

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
  // Register Telegram webhook after a short delay to ensure the server is
  // fully accepting connections before Telegram tries to verify the URL.
  setTimeout(() => {
    void registerTelegramWebhook().catch((err: unknown) => {
      logger.fatal({ err }, "Telegram webhook registration failed; stopping startup");
      process.exit(1);
    });
  }, 3000);
});
