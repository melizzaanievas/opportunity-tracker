import { Router, type IRouter } from "express";
import { HealthCheckResponse } from "@workspace/api-zod";
import {
  checkTelegramWebhook,
  getTelegramWebhookReadiness,
  registerTelegramWebhook,
} from "../lib/register-webhook";
import { requireAuth } from "../middlewares/auth";

const router: IRouter = Router();

router.get("/healthz", async (req, res) => {
  const refresh = req.query.refresh === "true" || req.query.refresh === "1";
  if (refresh) {
    await checkTelegramWebhook(req.headers.host);
  }

  const data = HealthCheckResponse.parse({
    status: "ok",
    telegramWebhook: getTelegramWebhookReadiness(),
  });
  res.json(data);
});

router.post(
  "/integrations/telegram-webhook/register",
  requireAuth,
  async (req, res): Promise<void> => {
    try {
      await registerTelegramWebhook(req.headers.host);
      const readiness = getTelegramWebhookReadiness();

      if (readiness.status !== "successful") {
        req.log.warn(
          { status: readiness.status },
          "Telegram webhook recovery is not configured",
        );
        res.status(503).json({
          error:
            readiness.description ??
            "Telegram webhook registration is not configured",
        });
        return;
      }

      res.json(
        HealthCheckResponse.parse({
          status: "ok",
          telegramWebhook: readiness,
        }),
      );
    } catch (err) {
      req.log.error({ err }, "Telegram webhook recovery failed");
      res.status(502).json({
        error:
          err instanceof Error
            ? err.message
            : "Telegram webhook registration failed",
      });
    }
  },
);

export default router;
