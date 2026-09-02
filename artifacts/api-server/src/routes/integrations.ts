import { Router, type IRouter, type Request, type Response } from "express";
import { eq } from "drizzle-orm";
import { db, opportunitiesTable } from "../db";
import { requireAuth } from "../middlewares/auth";
import {
  AddToCalendarParams,
  GoogleOAuthCallbackQueryParams,
} from "@workspace/api-zod";
import {
  generateOAuthState,
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

  const opportunityId = params.data.id;
  const [opp] = await db
    .select()
    .from(opportunitiesTable)
    .where(eq(opportunitiesTable.id, opportunityId));

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
    const state = generateOAuthState();
    const authUrl = getAuthUrl(state);
    req.session.googleOAuthState = { value: state, opportunityId };

    try {
      await new Promise<void>((resolve, reject) => {
        req.session.save((err) => {
          if (err) {
            reject(err);
            return;
          }
          resolve();
        });
      });
    } catch (err) {
      req.log.error({ err }, "Failed to save Google OAuth session state");
      res.status(500).json({ error: "Session error" });
      return;
    }

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
router.get("/integrations/google/callback", requireAuth, async (req, res): Promise<void> => {
  const parsedQuery = GoogleOAuthCallbackQueryParams.safeParse(req.query);
  if (!parsedQuery.success) {
    req.log.warn("Invalid Google OAuth callback query");
    res.redirect(`/?google_error=1`);
    return;
  }

  const { code, state, error } = parsedQuery.data;
  const pendingOAuthState = req.session.googleOAuthState;
  if (
    !pendingOAuthState ||
    !state ||
    state !== pendingOAuthState.value
  ) {
    req.log.warn("Invalid or missing Google OAuth state");
    res.redirect(`/?google_error=1`);
    return;
  }

  // OAuth states are single-use. Remove and persist the state before using
  // the authorization code so a callback cannot be replayed.
  delete req.session.googleOAuthState;
  if (error || !code) {
    req.log.warn({ error }, "Google OAuth error");
    res.redirect(`/?google_error=1`);
    return;
  }

  try {
    await new Promise<void>((resolve, reject) => {
      req.session.save((err) => {
        if (err) {
          reject(err);
          return;
        }
        resolve();
      });
    });

    await exchangeCodeForToken(code);
    // After getting the token, create the calendar event for the original opportunity
    const [opp] = await db
      .select()
      .from(opportunitiesTable)
      .where(eq(opportunitiesTable.id, pendingOAuthState.opportunityId));
    if (opp && opp.deadline) {
      await createCalendarEvent({
        title: opp.title,
        deadline: opp.deadline,
        summary: opp.summary,
        url: opp.url,
      });
    }
    res.redirect(`/opportunity/${pendingOAuthState.opportunityId}?calendar_success=1`);
    return;
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

// The daily summary trigger is protected for dashboard/manual use.
router.post("/cron-daily-summary", requireAuth, runAuthenticatedDailySummary);

export default router;
