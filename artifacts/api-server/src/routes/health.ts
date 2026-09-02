import { Router, type IRouter } from "express";
import { HealthCheckResponse } from "@workspace/api-zod";
import { getTelegramWebhookReadiness } from "../lib/register-webhook";

const router: IRouter = Router();

router.get("/healthz", (_req, res) => {
  const data = HealthCheckResponse.parse({
    status: "ok",
    telegramWebhook: getTelegramWebhookReadiness(),
  });
  res.json(data);
});

export default router;
