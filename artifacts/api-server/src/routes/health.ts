import { Router, type IRouter } from "express";
import { HealthCheckResponse } from "@workspace/api-zod";
import {
  checkTelegramWebhook,
  getTelegramWebhookReadiness,
} from "../lib/register-webhook";

const router: IRouter = Router();

router.get("/healthz", async (req, res) => {
  const refresh = req.query.refresh === "true" || req.query.refresh === "1";
  if (refresh) {
    await checkTelegramWebhook();
  }

  const data = HealthCheckResponse.parse({
    status: "ok",
    telegramWebhook: getTelegramWebhookReadiness(),
  });
  res.json(data);
});

export default router;
