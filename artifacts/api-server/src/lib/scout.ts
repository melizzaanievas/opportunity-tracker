import { eq } from "drizzle-orm";
import { db, preferencesTable, scoutJobsTable } from "../db";
import {
  escapeTelegramHtml,
  sendScoutTelegramMessage,
} from "./telegram";
import { logger } from "./logger";

const FEEDS = {
  remoteOk: "https://remoteok.com/api",
  remotive: "https://remotive.com/remote-jobs/feed",
} as const;

export interface ScoutPreferences {
  targetTitles: string[];
  preferredLocations: string[];
  preferredJobTypes: string[];
  updatedAt: string;
}

export interface ScoutPosting {
  sourceId: string;
  source: string;
  title: string;
  company: string | null;
  url: string;
  description: string | null;
  location: string | null;
  jobType: string | null;
}

export interface ScoutRunResult {
  success: boolean;
  message: string;
  discovered: number;
  sent: number;
  skipped: number;
}

let scoutRunInProgress = false;

function decodeXml(value: string): string {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function cleanText(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const cleaned = value
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned || null;
}

function extractXmlTag(item: string, tag: string): string | null {
  const match = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, "i").exec(item);
  return match ? cleanText(decodeXml(match[1])) : null;
}

function normalize(value: string): string {
  return value.toLocaleLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function meaningfulTokens(value: string): string[] {
  return normalize(value)
    .split(" ")
    .filter((token) => token.length > 2 && !["and", "the", "for", "with"].includes(token));
}

function matchesTitle(title: string, targets: string[]): boolean {
  const normalizedTitle = normalize(title);
  const titleTokens = new Set(meaningfulTokens(title));
  return targets.some((target) => {
    const normalizedTarget = normalize(target);
    if (normalizedTarget && normalizedTitle.includes(normalizedTarget)) return true;
    const tokens = meaningfulTokens(target);
    const overlap = tokens.filter((token) => titleTokens.has(token)).length;
    return tokens.length === 1 ? overlap === 1 : overlap >= 2;
  });
}

function matchesLocation(job: ScoutPosting, locations: string[]): boolean {
  const haystack = normalize(
    [job.location, job.description, job.title].filter(Boolean).join(" "),
  );
  return locations.some((location) => {
    const normalizedLocation = normalize(location);
    if (haystack.includes(normalizedLocation)) return true;
    if (normalizedLocation.includes("remote")) {
      return /\b(remote|worldwide|global|anywhere)\b/.test(haystack);
    }
    if (normalizedLocation.includes("apac") || normalizedLocation.includes("asia")) {
      return /\b(apac|asia|asia pacific|asia-pacific)\b/.test(haystack);
    }
    return false;
  });
}

function inferJobType(job: ScoutPosting): string {
  return normalize(job.jobType ?? "").replace(/\s+/g, "");
}

function matchesJobType(job: ScoutPosting, jobTypes: string[]): boolean {
  const jobType = inferJobType(job);
  return jobTypes.some((type) => {
    const normalizedType = normalize(type).replace(" ", "");
    if (normalizedType === "fulltime") return jobType.includes("fulltime");
    if (normalizedType === "parttime") return jobType.includes("parttime");
    return jobType.includes(normalize(type));
  });
}

function parseRemoteOk(payload: unknown): ScoutPosting[] {
  if (!Array.isArray(payload)) return [];
  return payload.flatMap((item, index) => {
    if (!item || typeof item !== "object") return [];
    const record = item as Record<string, unknown>;
    const title = cleanText(record.position);
    const slug = cleanText(record.slug) ?? cleanText(record.id) ?? `remoteok-${index}`;
    if (!title || !slug) return [];
    const url =
      cleanText(record.url) ??
      `https://remoteok.com/remote-jobs/${encodeURIComponent(slug)}`;
    const tags = Array.isArray(record.tags)
      ? record.tags.filter((tag): tag is string => typeof tag === "string").join(" ")
      : "";
    return [{
      sourceId: slug,
      source: "Remote OK",
      title,
      company: cleanText(record.company),
      url,
      description: cleanText(record.description),
      location: cleanText(record.location),
      jobType: `${cleanText(record.job_type) ?? ""} ${tags}`.trim() || null,
    }];
  });
}

function parseRemotive(xml: string): ScoutPosting[] {
  const items = xml.match(/<item\b[^>]*>[\s\S]*?<\/item>/gi) ?? [];
  return items.flatMap((item, index) => {
    const title = extractXmlTag(item, "title");
    const url = extractXmlTag(item, "link");
    if (!title || !url) return [];
    return [{
      sourceId: extractXmlTag(item, "guid") ?? `remotive-${index}`,
      source: "Remotive",
      title,
      company: extractXmlTag(item, "company"),
      url,
      description:
        extractXmlTag(item, "description") ??
        extractXmlTag(item, "content:encoded"),
      location: extractXmlTag(item, "candidate-required-location"),
      jobType: extractXmlTag(item, "job-type"),
    }];
  });
}

async function fetchPostings(): Promise<ScoutPosting[]> {
  const results = await Promise.allSettled([
    fetch(FEEDS.remoteOk, {
      headers: { "User-Agent": "OpportunityTrackerJobScout/1.0" },
      signal: AbortSignal.timeout(15000),
    }).then(async (response) => {
      if (!response.ok) throw new Error(`Remote OK returned ${response.status}`);
      return parseRemoteOk(await response.json());
    }),
    fetch(FEEDS.remotive, {
      headers: { "User-Agent": "OpportunityTrackerJobScout/1.0" },
      signal: AbortSignal.timeout(15000),
    }).then(async (response) => {
      if (!response.ok) throw new Error(`Remotive returned ${response.status}`);
      return parseRemotive(await response.text());
    }),
  ]);

  const postings: ScoutPosting[] = [];
  for (const result of results) {
    if (result.status === "fulfilled") {
      postings.push(...result.value);
    } else {
      logger.warn({ err: result.reason }, "Job scout feed failed");
    }
  }
  return postings;
}

export async function getScoutPreferences(): Promise<ScoutPreferences> {
  const [row] = await db
    .select()
    .from(preferencesTable)
    .where(eq(preferencesTable.id, 1));

  const parse = (value: string): string[] => {
    try {
      const parsed: unknown = JSON.parse(value);
      return Array.isArray(parsed)
        ? parsed.filter((item): item is string => typeof item === "string")
        : [];
    } catch {
      return [];
    }
  };

  return {
    targetTitles: parse(row?.targetTitles ?? "[]"),
    preferredLocations: parse(row?.preferredLocations ?? "[]"),
    preferredJobTypes: parse(row?.preferredJobTypes ?? "[]"),
    updatedAt: row?.updatedAt ?? new Date(0).toISOString(),
  };
}

export function formatScoutAlert(job: ScoutPosting, jobId: number): string {
  const description = job.description
    ? `${escapeTelegramHtml(job.description.slice(0, 700))}${job.description.length > 700 ? "…" : ""}`
    : "No description was provided by the feed.";
  const company = job.company ? `\n🏢 ${escapeTelegramHtml(job.company)}` : "";
  const location = job.location ? `\n📍 ${escapeTelegramHtml(job.location)}` : "";
  const jobType = job.jobType ? `\n🧭 ${escapeTelegramHtml(job.jobType)}` : "";
  const safeUrl = escapeTelegramHtml(job.url);

  return [
    "🔎 <b>Job Scout Match</b>",
    "",
    `<b>${escapeTelegramHtml(job.title)}</b>${company}${location}${jobType}`,
    "",
    description,
    "",
    `🔗 <a href="${safeUrl}">View posting</a>`,
  ].join("\n");
}

export async function runJobScout(): Promise<ScoutRunResult> {
  if (scoutRunInProgress) {
    return {
      success: false,
      message: "A scout run is already in progress.",
      discovered: 0,
      sent: 0,
      skipped: 0,
    };
  }

  scoutRunInProgress = true;
  try {
    const preferences = await getScoutPreferences();
    if (preferences.targetTitles.length === 0) {
      return {
        success: true,
        message: "Scout skipped: add at least one target title first.",
        discovered: 0,
        sent: 0,
        skipped: 0,
      };
    }

    const postings = (await fetchPostings()).filter(
      (job) =>
        matchesTitle(job.title, preferences.targetTitles) &&
        (preferences.preferredLocations.length === 0 ||
          matchesLocation(job, preferences.preferredLocations)) &&
        (preferences.preferredJobTypes.length === 0 ||
          matchesJobType(job, preferences.preferredJobTypes)),
    );

    let sent = 0;
    let skipped = 0;
    for (const posting of postings) {
      let [candidate] = await db
        .select()
        .from(scoutJobsTable)
        .where(eq(scoutJobsTable.url, posting.url));

      if (!candidate) {
        [candidate] = await db
          .insert(scoutJobsTable)
          .values({
            sourceId: posting.sourceId,
            source: posting.source,
            title: posting.title,
            company: posting.company,
            url: posting.url,
            description: posting.description,
            location: posting.location,
            jobType: posting.jobType,
            discoveredAt: new Date().toISOString(),
          })
          .returning();
      }

      if (!candidate || candidate.status !== "pending" || candidate.notifiedAt) {
        skipped += 1;
        continue;
      }

      const messageId = await sendScoutTelegramMessage(
        formatScoutAlert(posting, candidate.id),
        candidate.id,
      );
      if (messageId === null) {
        skipped += 1;
        continue;
      }

      await db
        .update(scoutJobsTable)
        .set({
          telegramMessageId: messageId,
          notifiedAt: new Date().toISOString(),
        })
        .where(eq(scoutJobsTable.id, candidate.id));
      sent += 1;
    }

    return {
      success: true,
      message: sent > 0 ? `Sent ${sent} new job scout alert(s).` : "No new matching jobs to alert.",
      discovered: postings.length,
      sent,
      skipped,
    };
  } finally {
    scoutRunInProgress = false;
  }
}