import { Router, type IRouter, type Request, type Response } from "express";
import { eq } from "drizzle-orm";
import { db, opportunitiesTable } from "../db";
import { requireAuth } from "../middlewares/auth";
import {
  AddToCalendarParams,
} from "@workspace/api-zod";
import {
  getAuthUrl,
  getStoredToken,
  createCalendarEvent,
  exchangeCodeForToken,
} from "../lib/calendar";
import { buildDailySummary, sendTelegramMessage } from "../lib/telegram";
import { logger } from "../lib/logger";

const router: IRouter = Router();

// Add to Google Calendar
router.post("/opportunities/:id/calendar", requireAuth, async (req, res): Promise<void> => {
  const params = AddToCalendarParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [opp] = await db
    .select()
    .from(opportunitiesTable)
    .where(eq(opportunitiesTable.id, params.data.id));

  if (!opp) {
    res.status(404).json({ error: "Opportunity not found" });
    return;
  }

  if (!opp.deadline) {
    res.status(400).json({ error: "Opportunity has no deadline set — add a deadline first." });
    return;
  }

  // Check if we have a stored token
  const token = await getStoredToken();
  if (!token) {
    const authUrl = getAuthUrl(params.data.id);
    res.json({ success: false, authUrl, message: null });
    return;
  }

  const result = await createCalendarEvent({
    title: opp.title,
    deadline: opp.deadline,
    summary: opp.summary,
    url: opp.url,
  });

  res.json({ success: result.success, authUrl: null, message: result.message });
});

// Google OAuth callback
router.get("/integrations/google/callback", async (req, res): Promise<void> => {
  const { code, state, error } = req.query as { code?: string; state?: string; error?: string };

  if (error || !code) {
    req.log.warn({ error }, "Google OAuth error");
    res.redirect(`/?google_error=1`);
    return;
  }

  try {
    await exchangeCodeForToken(code);
    // After getting the token, create the calendar event for the original opportunity
    if (state) {
      const oppId = parseInt(state, 10);
      if (!isNaN(oppId)) {
        const [opp] = await db
          .select()
          .from(opportunitiesTable)
          .where(eq(opportunitiesTable.id, oppId));
        if (opp && opp.deadline) {
          await createCalendarEvent({
            title: opp.title,
            deadline: opp.deadline,
            summary: opp.summary,
            url: opp.url,
          });
        }
        res.redirect(`/opportunity/${oppId}?calendar_success=1`);
        return;
      }
    }
    res.redirect(`/?calendar_success=1`);
  } catch (err) {
    logger.error({ err }, "Google OAuth callback error");
    res.redirect(`/?google_error=1`);
  }
});

// Test Telegram alert
router.post("/integrations/telegram/test", requireAuth, async (req, res): Promise<void> => {
  const { text, count } = await buildDailySummary();
  const testText = `🧪 <b>Test Alert</b>\n\nThis is a test of your Opportunity Tracker Telegram integration.\n\n${count > 0 ? text : "No upcoming deadlines to show, but the bot is working!"}`;
  const ok = await sendTelegramMessage(testText);
  res.json({
    success: ok,
    message: ok ? "Test message sent to Telegram!" : "Failed to send — check your TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID.",
    sent: ok ? 1 : 0,
  });
});

async function runAuthenticatedDailySummary(_req: Request, res: Response): Promise<void> {
  const { text, count } = await buildDailySummary();
  let ok = true;
  if (count > 0) {
    ok = await sendTelegramMessage(text);
  }
  res.json({
    success: ok,
    message: count > 0 ? `Sent digest with ${count} opportunities` : "No upcoming deadlines",
    sent: count,
  });
}

export async function runPublicDailySummary(_req: Request, res: Response): Promise<void> {
  try {
    const { text } = await buildDailySummary();
    const sent = await sendTelegramMessage(text);

    if (!sent) {
      res.status(502).json({
        success: false,
        message: "Failed to send daily summary to Telegram",
      });
      return;
    }

    res.setHeader("Content-Type", "application/json");
    res.status(200).json({
      success: true,
      message: "Daily summary sent",
    });
  } catch (err) {
    logger.error({ err }, "Public daily summary failed");
    res.status(500).json({
      success: false,
      message: "Failed to generate daily summary",
    });
  }
}

// The public GET endpoint is mounted at the app level in app.ts so it is
// registered before the complete API router. The POST variant remains
// protected for dashboard/manual use.
router.post("/cron-daily-summary", requireAuth, runAuthenticatedDailySummary);

export default router;
