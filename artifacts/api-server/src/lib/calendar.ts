import { google } from "googleapis";
import { randomBytes } from "node:crypto";
import { logger } from "./logger";
import { db, settingsTable } from "../db";
import { eq } from "drizzle-orm";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type OAuthCredentials = Record<string, any>;

const SCOPES = ["https://www.googleapis.com/auth/calendar.events"];

function getRedirectUri(): string {
  const devDomain = process.env.REPLIT_DEV_DOMAIN;
  const domains = process.env.REPLIT_DOMAINS;
  if (domains) {
    const firstDomain = domains.split(",")[0].trim();
    return `https://${firstDomain}/api/integrations/google/callback`;
  }
  if (devDomain) {
    return `https://${devDomain}/api/integrations/google/callback`;
  }
  return "http://localhost/api/integrations/google/callback";
}

export function createOAuth2Client() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error("GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET must be set");
  }
  return new google.auth.OAuth2(clientId, clientSecret, getRedirectUri());
}

export function generateOAuthState(): string {
  return randomBytes(32).toString("hex");
}

export function getAuthUrl(state: string): string {
  const oauth2Client = createOAuth2Client();
  return oauth2Client.generateAuthUrl({
    access_type: "offline",
    scope: SCOPES,
    state,
    prompt: "consent",
  });
}

export async function getStoredToken(): Promise<OAuthCredentials | null> {
  const [row] = await db
    .select()
    .from(settingsTable)
    .where(eq(settingsTable.key, "google_token"));
  if (!row) return null;
  try {
    return JSON.parse(row.value) as OAuthCredentials;
  } catch {
    return null;
  }
}

export async function storeToken(token: OAuthCredentials): Promise<void> {
  await db
    .insert(settingsTable)
    .values({ key: "google_token", value: JSON.stringify(token) })
    .onConflictDoUpdate({
      target: settingsTable.key,
      set: { value: JSON.stringify(token) },
    });
}

export async function exchangeCodeForToken(code: string): Promise<OAuthCredentials> {
  const oauth2Client = createOAuth2Client();
  const { tokens } = await oauth2Client.getToken(code);
  await storeToken(tokens);
  return tokens;
}

interface CalendarEventData {
  title: string;
  deadline: string;
  summary: string | null;
  url: string;
}

export async function createCalendarEvent(
  data: CalendarEventData,
): Promise<{ success: boolean; message: string }> {
  try {
    const token = await getStoredToken();
    if (!token) {
      return { success: false, message: "No Google token stored" };
    }

    const oauth2Client = createOAuth2Client();
    oauth2Client.setCredentials(token);

    oauth2Client.on("tokens", async (newTokens) => {
      await storeToken({ ...token, ...newTokens });
    });

    const calendar = google.calendar({ version: "v3", auth: oauth2Client });

    const endDate = new Date(data.deadline);
    endDate.setDate(endDate.getDate() + 1);

    const event = {
      summary: `DEADLINE: ${data.title}`,
      description: [data.summary ?? "", "", `${data.url}`]
        .filter(Boolean)
        .join("\n"),
      start: { date: data.deadline },
      end: { date: endDate.toISOString().slice(0, 10) },
      reminders: {
        useDefault: false,
        overrides: [
          { method: "popup" as const, minutes: 60 * 24 },
          { method: "popup" as const, minutes: 60 * 24 * 3 },
        ],
      },
    };

    await calendar.events.insert({ calendarId: "primary", requestBody: event });
    return { success: true, message: "Event added to Google Calendar" };
  } catch (err) {
    logger.error({ err }, "Failed to create calendar event");
    return { success: false, message: "Failed to create calendar event" };
  }
}
