import cron from "node-cron";
import { logger } from "./logger";
import { buildDailySummary, sendTelegramMessage } from "./telegram";
import { runJobScout } from "./scout";
import { checkTelegramWebhook } from "./register-webhook";

export function startCronJobs(): void {
  cron.schedule(
    "*/5 * * * *",
    () => {
      logger.info("Checking live Telegram webhook configuration");
      void checkTelegramWebhook().catch((err: unknown) => {
        logger.error({ err }, "Telegram webhook health check failed");
      });
    },
    { timezone: "UTC" },
  );

  // Run at 8:00 AM every day
  cron.schedule("0 8 * * *", async () => {
    logger.info("Running daily Telegram summary cron");
    try {
      const { text, count } = await buildDailySummary();
      if (count > 0) {
        const ok = await sendTelegramMessage(text);
        logger.info({ ok, count }, "Daily summary sent");
      } else {
        logger.info("No upcoming deadlines — skipping Telegram message");
      }
    } catch (err) {
      logger.error({ err }, "Cron job failed");
    }
  });

  cron.schedule(
    "0 1 * * *",
    async () => {
      logger.info("Running daily job scout cron");
      try {
        const result = await runJobScout();
        logger.info(result, "Daily job scout completed");
      } catch (err) {
        logger.error({ err }, "Job scout cron failed");
      }
    },
    { timezone: "UTC" },
  );

  logger.info(
    "Cron jobs registered (webhook check every 5 minutes, job scout at 01:00 UTC, daily summary at 8:00 AM)",
  );
}
