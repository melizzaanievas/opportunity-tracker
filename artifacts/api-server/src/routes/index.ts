import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import opportunitiesRouter from "./opportunities";
import tasksRouter from "./tasks";
import integrationsRouter from "./integrations";
import dashboardRouter from "./dashboard";
import telegramWebhookRouter from "./telegram-webhook";
import preferencesRouter from "./preferences";
import scoutRouter from "./scout";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(opportunitiesRouter);
router.use(tasksRouter);
router.use(integrationsRouter);
router.use(dashboardRouter);
router.use(preferencesRouter);
router.use(scoutRouter);
// Telegram webhook — no session auth, called by Telegram's servers
router.use(telegramWebhookRouter);

export default router;
