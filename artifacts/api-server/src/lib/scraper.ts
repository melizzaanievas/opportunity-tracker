import * as cheerio from "cheerio";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { logger } from "./logger";

export type OpportunityCategory =
  | "job"
  | "grant"
  | "casting"
  | "singing-competition"
  | "grant-fellowship"
  | "other";

interface ScrapedResult {
  title: string | null;
  deadline: string | null;
  summary: string | null;
  keyActionSteps: string | null;
  actionPlanTasks: string[];
  type: OpportunityCategory;
  scrapeSuccess: boolean;
}

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
].join("|");

const DATE_PATTERNS = [
  // Labeled deadlines: "Deadline: January 15, 2025", "Closing Date: 2025-01-15",
  // and "Apply by 15 January 2025".
  new RegExp(
    String.raw`(?:deadline|closing\s+date|closing|due\s+date|due|apply\s+by|submission\s+date|applications?\s+(?:due|close))\s*[:\-]?\s*(\d{4}-\d{2}-\d{2}|\d{1,2}[/-]\d{1,2}[/-]\d{4}|(?:${MONTH_NAMES})\s+\d{1,2}(?:st|nd|rd|th)?[,]?\s+\d{4}|\d{1,2}\s+(?:${MONTH_NAMES})\s+\d{4})`,
    "gi",
  ),
  // ISO dates are unambiguous and commonly rendered without a label.
  /\b(\d{4}-\d{2}-\d{2})\b/g,
  // Slash and hyphen dates are treated as month/day/year unless the first
  // component is greater than 12, in which case they are day/month/year.
  /\b(\d{1,2}[/-]\d{1,2}[/-]\d{4})\b/g,
  // "15 January 2025".
  new RegExp(String.raw`\b(\d{1,2}\s+(?:${MONTH_NAMES})\s+\d{4})\b`, "gi"),
];

const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);
const MAX_REDIRECTS = 5;
const SCRAPE_TIMEOUT_MS = 3000;

/**
 * URL validation errors are kept separate from ordinary fetch failures so
 * callers can reject an unsafe target instead of treating it as a normal
 * page that failed to load.
 */
export class UnsafeScrapeUrlError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UnsafeScrapeUrlError";
  }
}

function ipv4ToNumber(address: string): number {
  return address.split(".").reduce((value, part) => value * 256 + Number(part), 0);
}

function isBlockedIpv4(address: string): boolean {
  const [first, second, third] = address.split(".").map(Number);

  return (
    first === 0 ||
    first === 10 ||
    first === 100 && second >= 64 && second <= 127 ||
    first === 127 ||
    first === 169 && second === 254 ||
    first === 172 && second >= 16 && second <= 31 ||
    first === 192 && second === 0 && third === 0 ||
    first === 192 && second === 0 && third === 2 ||
    first === 192 && second === 88 && third === 99 ||
    first === 192 && second === 168 ||
    first === 198 && second === 18 ||
    first === 198 && second === 19 ||
    first === 198 && second === 51 && third === 100 ||
    first === 203 && second === 0 && third === 113 ||
    first >= 224
  );
}

function ipv6ToBigInt(address: string): bigint | null {
  let normalized = address.toLowerCase();

  // Expand an embedded IPv4 address into its two hexadecimal groups.
  if (normalized.includes(".")) {
    const lastColon = normalized.lastIndexOf(":");
    const embeddedIpv4 = normalized.slice(lastColon + 1);
    if (isIP(embeddedIpv4) !== 4) return null;
    const ipv4 = ipv4ToNumber(embeddedIpv4);
    normalized = `${normalized.slice(0, lastColon)}:${(ipv4 >>> 16).toString(16)}:${(ipv4 & 0xffff).toString(16)}`;
  }

  const sections = normalized.split("::");
  if (sections.length > 2) return null;

  const left = sections[0] ? sections[0].split(":") : [];
  const right = sections.length === 2 && sections[1] ? sections[1].split(":") : [];
  const missingGroups = 8 - left.length - right.length;
  if ((sections.length === 1 && missingGroups !== 0) || (sections.length === 2 && missingGroups < 1)) {
    return null;
  }

  const groups = [...left, ...Array(missingGroups).fill("0"), ...right];
  if (groups.length !== 8 || groups.some((group) => !/^[0-9a-f]{1,4}$/.test(group))) {
    return null;
  }

  return groups.reduce((value, group) => (value << 16n) | BigInt(`0x${group}`), 0n);
}

const BLOCKED_IPV6_RANGES = [
  { network: ipv6ToBigInt("::")!, prefixLength: 128 }, // unspecified
  { network: ipv6ToBigInt("::1")!, prefixLength: 128 }, // loopback
  { network: ipv6ToBigInt("fc00::")!, prefixLength: 7 }, // unique local
  { network: ipv6ToBigInt("fe80::")!, prefixLength: 10 }, // link local
  { network: ipv6ToBigInt("ff00::")!, prefixLength: 8 }, // multicast
  { network: ipv6ToBigInt("2001:db8::")!, prefixLength: 32 }, // documentation
];

function isBlockedIpv6(address: string): boolean {
  const value = ipv6ToBigInt(address);
  if (value === null) return true;

  // Treat IPv4-mapped and IPv4-compatible IPv6 addresses like their IPv4
  // counterparts, so ::ffff:127.0.0.1 cannot bypass the private-range check.
  const embeddedIpv4Prefix = value >> 32n;
  if (embeddedIpv4Prefix === 0n || embeddedIpv4Prefix === 0xffffn) {
    const embeddedIpv4 = Number(value & 0xffffffffn);
    const addressParts = [
      (embeddedIpv4 >>> 24) & 0xff,
      (embeddedIpv4 >>> 16) & 0xff,
      (embeddedIpv4 >>> 8) & 0xff,
      embeddedIpv4 & 0xff,
    ].join(".");
    if (isBlockedIpv4(addressParts)) return true;
  }

  return BLOCKED_IPV6_RANGES.some(({ network, prefixLength }) => {
    const mask = ((1n << BigInt(prefixLength)) - 1n) << BigInt(128 - prefixLength);
    return (value & mask) === network;
  });
}

function isBlockedAddress(address: string): boolean {
  const family = isIP(address);
  return family === 4 ? isBlockedIpv4(address) : family === 6 ? isBlockedIpv6(address) : true;
}

/**
 * Parse and resolve a URL before every request. DNS answers are checked
 * because validating only the textual hostname would allow a public hostname
 * that resolves to an internal address.
 */
export async function validateScrapeUrl(input: string): Promise<URL> {
  let parsed: URL;
  try {
    parsed = new URL(input);
  } catch {
    throw new UnsafeScrapeUrlError("The scrape URL is invalid");
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new UnsafeScrapeUrlError("Only HTTP and HTTPS scrape URLs are allowed");
  }
  if (!parsed.hostname || parsed.username || parsed.password) {
    throw new UnsafeScrapeUrlError("The scrape URL must contain a hostname without credentials");
  }

  const hostname = parsed.hostname.replace(/^\[|\]$/g, "").toLowerCase();
  const hostnameWithoutTrailingDot = hostname.endsWith(".") ? hostname.slice(0, -1) : hostname;
  if (
    hostnameWithoutTrailingDot === "localhost" ||
    hostnameWithoutTrailingDot.endsWith(".localhost") ||
    hostnameWithoutTrailingDot.endsWith(".local")
  ) {
    throw new UnsafeScrapeUrlError("Local hostnames are not allowed");
  }

  let addresses: string[];
  if (isIP(hostname)) {
    addresses = [hostname];
  } else {
    try {
      addresses = (await lookup(hostname, { all: true, verbatim: true })).map(({ address }) => address);
    } catch {
      throw new UnsafeScrapeUrlError("The scrape hostname could not be resolved");
    }
  }

  if (addresses.length === 0 || addresses.some(isBlockedAddress)) {
    throw new UnsafeScrapeUrlError("The scrape URL must not target a local or private network");
  }

  return parsed;
}

function cleanText(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

const SINGING_CATEGORY_PATTERN =
  /\b(?:singing|singer|vocal|vocalist|singing competition)\b/i;
const CASTING_CATEGORY_PATTERN =
  /\b(?:audition|casting|role|performer|talent\s+call)\b/i;
const GRANT_CATEGORY_PATTERN =
  /\b(?:grant|funding|fellowship|bounty|proposal)\b/i;

const ACTION_PLAN_DELIVERABLES: Array<{
  pattern: RegExp;
  task: string;
}> = [
  {
    pattern: /\b(?:resume|résumé|cv)\b/i,
    task: "Update and tailor CV/Resume",
  },
  {
    pattern: /\bcover\s+letter\b|\bstatements?\b/i,
    task: "Draft cover letter / application statement",
  },
  {
    pattern: /\b(?:video|audition|reel|recording)\b/i,
    task: "Record & submit video reel / audition recording",
  },
  {
    pattern: /\b(?:headshots?|portfolio)\b/i,
    task: "Prepare high-res headshot / portfolio links",
  },
  {
    pattern: /\breferences?\b/i,
    task: "Gather professional reference contacts",
  },
  {
    pattern: /\b(?:proposal|essay)\b/i,
    task: "Draft project proposal / essay response",
  },
  {
    pattern: /\b(?:demo|code\s+sample|github|repository|repo)\b/i,
    task: "Prepare project demo or code sample",
  },
];

/**
 * Detect common submission deliverables in visible page text and metadata.
 * The task order follows the checklist's stable presentation order rather
 * than the order in which a provider happens to mention each requirement.
 */
export function detectActionPlanTasks(text: string): string[] {
  const normalized = cleanText(text);
  return ACTION_PLAN_DELIVERABLES.flatMap(({ pattern, task }) =>
    pattern.test(normalized) ? [task] : [],
  );
}

export function detectOpportunityCategory(text: string): OpportunityCategory {
  const normalized = cleanText(text);
  if (SINGING_CATEGORY_PATTERN.test(normalized)) return "singing-competition";
  if (CASTING_CATEGORY_PATTERN.test(normalized)) return "casting";
  if (GRANT_CATEGORY_PATTERN.test(normalized)) return "grant";
  return "job";
}

const BOILERPLATE_TITLE_STRINGS = [
  "| Everyone's app platform",
  "Security Check",
  "Log In",
  "Sign Up",
  "| LinkedIn",
  "- LinkedIn",
  "- Google Forms",
];

const GENERIC_SUMMARY_PATTERNS = [
  /^airtable\s+is\s+a\s+low[- ]code\s+platform\b/i,
  /^linkedin\s+is\s+the\s+world['’]s\s+largest\s+professional\s+network\b/i,
  /^google\s+forms?\s*[:\-]\s*sign[- ]?in\b/i,
  /^sign[- ]?in\s+to\s+(?:google\s+)?forms?\b/i,
];

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Remove provider-owned suffixes and access-wall text before deciding whether
 * a page title is useful to a person tracking the opportunity.
 */
export function cleanupTitle(value: string | null | undefined): string | null {
  if (!value) return null;

  let cleaned = cleanText(value);
  for (const boilerplate of BOILERPLATE_TITLE_STRINGS) {
    cleaned = cleaned.replace(new RegExp(escapeRegExp(boilerplate), "gi"), " ");
  }

  cleaned = cleanText(cleaned)
    .replace(/^[|:–—-]+|[|:–—-]+$/g, "")
    .replace(/\s+(?:or|and)\s*$/i, "")
    .replace(/^[|:–—-]+|[|:–—-]+$/g, "");

  if (
    !cleaned ||
    /^linkedin(?:\s*[:|-])?$/i.test(cleaned) ||
    /^airtable$/i.test(cleaned) ||
    /^google forms?$/i.test(cleaned)
  ) {
    return null;
  }

  return cleaned;
}

/**
 * Discard provider-owned marketing copy while preserving real opportunity
 * summaries. Returning null keeps the value blank for both the add form and
 * Telegram-created opportunities.
 */
export function cleanSummary(value: string | null | undefined): string | null {
  const cleaned = cleanText(value ?? "");
  if (!cleaned) return null;

  const normalized = cleaned.replace(/[’]/g, "'").replace(/\s+/g, " ");
  if (GENERIC_SUMMARY_PATTERNS.some((pattern) => pattern.test(normalized))) {
    return null;
  }

  return cleaned.slice(0, 500) || null;
}

function selectSummary(candidates: Array<string | null | undefined>): string | null {
  for (const candidate of candidates) {
    const cleaned = cleanSummary(candidate);
    if (cleaned) return cleaned;
  }
  return null;
}

function getHostname(input: string): string {
  try {
    return new URL(input).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return "";
  }
}

export function getPlatformName(input: string): string | null {
  const hostname = getHostname(input);
  if (hostname === "airtable.com" || hostname.endsWith(".airtable.com")) return "Airtable";
  if (hostname === "linkedin.com" || hostname.endsWith(".linkedin.com")) return "LinkedIn";
  if (hostname === "forms.gle" || (hostname === "docs.google.com" && input.includes("/forms"))) {
    return "Google Forms";
  }
  return null;
}

function isLinkedInJobsUrl(input: string): boolean {
  try {
    const parsed = new URL(input);
    return (
      (parsed.hostname === "linkedin.com" || parsed.hostname.endsWith(".linkedin.com")) &&
      /^\/jobs(?:\/|$)/i.test(parsed.pathname)
    );
  } catch {
    return false;
  }
}

function humanizePathSegment(segment: string): string {
  return cleanText(
    decodeURIComponent(segment)
      .replace(/\.[a-z0-9]+$/i, "")
      .replace(/[-_+]+/g, " "),
  ).replace(/\b[a-z]/g, (character) => character.toUpperCase());
}

function extractLinkedInPathTitle(input: string): string | null {
  try {
    const segments = new URL(input).pathname.split("/").filter(Boolean);
    const viewIndex = segments.findIndex((segment) => segment.toLowerCase() === "view");
    const candidate = viewIndex >= 0 ? segments[viewIndex + 1] : segments.at(-1);
    if (!candidate) return null;

    const title = humanizePathSegment(candidate);
    if (!title) return null;
    return /^\d+$/.test(title.replace(/\s/g, "")) ? `LinkedIn Job ${title}` : title;
  } catch {
    return null;
  }
}

function extractAirtablePathTitle(input: string): string | null {
  try {
    const parsed = new URL(input);
    const segments = parsed.pathname.split("/").filter(Boolean);
    const isFormPath =
      /\/(?:forms?|shr)[^/]*\/?/i.test(parsed.pathname) ||
      segments.some((segment) => /^shr[a-z0-9]+$/i.test(segment));
    if (isFormPath) return "Airtable Form Submission";

    const baseId = segments.find((segment) => /^app[a-z0-9]+$/i.test(segment));
    return baseId ? `Airtable Base ${baseId}` : null;
  } catch {
    return null;
  }
}

function isGenericTitle(title: string | null, platform: string | null): boolean {
  if (!title) return true;
  if (/everyone's app platform/i.test(title)) return true;
  if (/security check|log in|sign up|sign[- ]?in/i.test(title)) return true;
  if (
    platform === "Airtable" &&
    (/^airtable(?:\s*[|:-].*)?$/i.test(title) ||
      /^airtable\b.*(?:low[- ]code platform|app platform)/i.test(title))
  ) {
    return true;
  }
  if (/^linkedin\b.*(?:world['’]s largest professional network|professional network)/i.test(title)) {
    return true;
  }
  if (platform === "LinkedIn" && /^linkedin(?:\s+jobs?)?$/i.test(title)) return true;
  if (
    platform === "Google Forms" &&
    (/^google forms?$/i.test(title) || /^google forms?\s*[:|-]\s*sign[- ]?in/i.test(title))
  ) {
    return true;
  }
  return false;
}

function isGenericAirtableTitle(value: string | null | undefined): boolean {
  const normalized = cleanText(value ?? "");
  return /^airtable(?:\s*\|\s*everyone['’]s app platform)?$/i.test(normalized);
}

function selectPageTitle(url: string, candidates: Array<string | null | undefined>): string | null {
  const platform = getPlatformName(url);
  for (const candidate of candidates) {
    const cleaned = cleanupTitle(candidate);
    if (cleaned && !isGenericTitle(cleaned, platform)) return cleaned;
  }
  return null;
}

function formatShortDate(deadline: string | null): string | null {
  if (!deadline) return null;
  const parsed = new Date(`${deadline}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return null;
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(parsed);
}

function buildPlatformFallbackTitle(platform: string, deadline: string | null): string {
  const shortDate = formatShortDate(deadline);
  return `${platform} Opportunity${shortDate ? ` (${shortDate})` : ""}`;
}

export function resolveOpportunityTitle(
  url: string,
  scrapedTitle: string | null | undefined,
  deadline: string | null,
): string {
  const platform = getPlatformName(url);
  const title = cleanupTitle(scrapedTitle);

  if (isLinkedInJobsUrl(url)) {
    if (title && !isGenericTitle(title, platform)) return title;
    return extractLinkedInPathTitle(url) ?? buildPlatformFallbackTitle("LinkedIn", deadline);
  }

  if (platform === "Airtable") {
    if (isGenericAirtableTitle(scrapedTitle)) return "Airtable Form Application";
    if (title && !isGenericTitle(title, platform)) return title;
    return extractAirtablePathTitle(url) ?? buildPlatformFallbackTitle("Airtable", deadline);
  }

  if (title && !isGenericTitle(title, platform)) return title;
  if (platform) return buildPlatformFallbackTitle(platform, deadline);
  return title ?? getHostname(url) ?? "Untitled Opportunity";
}

export function parseScrapedHtml(url: string, html: string): ScrapedResult {
  const $ = cheerio.load(html);

  // Title candidates are cleaned and resolved after the deadline is known,
  // because platform fallback titles can include a short deadline date.
  const ogTitle = $('meta[property="og:title"]').attr("content");
  const twitterTitle = $('meta[name="twitter:title"]').attr("content");
  const htmlTitle = $("title").text();
  const h1 = $("h1").first().text();
  const titleCandidates = [ogTitle, twitterTitle, htmlTitle, h1];
  const pageTitle = selectPageTitle(url, titleCandidates);
  const genericAirtableTitle =
    getPlatformName(url) === "Airtable"
      ? titleCandidates.find((candidate) => isGenericAirtableTitle(candidate))
      : null;

  // Remove noise before extracting body text so navigation dates and
  // unrelated footer timestamps do not become the opportunity deadline.
  $("script, style, nav, footer, header").remove();

  // Summary
  const ogDesc = $('meta[property="og:description"]').attr("content");
  const metaDesc = $('meta[name="description"]').attr("content");
  const firstPara = $("article p, main p, .content p, p").first().text();
  const summary = selectSummary([ogDesc, metaDesc, firstPara]);

  // Prefer explicit deadline metadata and <time> values, then inspect the
  // visible page text for labeled or standalone date patterns.
  const bodyText = $("body").text();
  const deadlineMetadata = [
    $('meta[property="og:deadline"]').attr("content"),
    $('meta[name="deadline"]').attr("content"),
    $('meta[name="applicationDeadline"]').attr("content"),
    $('meta[itemprop="deadline"]').attr("content"),
    $('meta[itemprop="applicationDeadline"]').attr("content"),
    $("time[datetime]").first().attr("datetime"),
  ]
    .filter((value): value is string => Boolean(value))
    .join(" ");
  const deadline = extractDate(deadlineMetadata) ?? extractDate(bodyText);
  const title = resolveOpportunityTitle(
    url,
    pageTitle ?? genericAirtableTitle,
    deadline,
  );
  const type = detectOpportunityCategory(
    [titleCandidates.join(" "), bodyText].join(" "),
  );
  const actionPlanTasks = detectActionPlanTasks(
    [titleCandidates.join(" "), ogDesc, metaDesc, bodyText]
      .filter(Boolean)
      .join(" "),
  );

  // Key action steps from lists
  const listItems: string[] = [];
  $("ul li, ol li").each((_, el) => {
    const text = cleanText($(el).text());
    if (text.length > 10 && text.length < 200) {
      listItems.push(`• ${text}`);
    }
  });
  const keyActionSteps = listItems.slice(0, 8).join("\n") || null;

  return {
    title: title || null,
    deadline,
    summary,
    keyActionSteps,
    actionPlanTasks,
    type,
    scrapeSuccess: !!(title || summary),
  };
}

function toIsoDate(year: number, month: number, day: number): string | null {
  const parsed = new Date(Date.UTC(year, month - 1, day));
  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month - 1 ||
    parsed.getUTCDate() !== day
  ) {
    return null;
  }
  return parsed.toISOString().slice(0, 10);
}

function parseDateValue(value: string): string | null {
  const normalized = cleanText(value)
    .replace(/(\d{1,2})(?:st|nd|rd|th)\b/gi, "$1")
    .replace(/\s+/g, " ");

  const isoMatch = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(normalized);
  if (isoMatch) {
    return toIsoDate(Number(isoMatch[1]), Number(isoMatch[2]), Number(isoMatch[3]));
  }

  const numericMatch = /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/.exec(normalized);
  if (numericMatch) {
    const first = Number(numericMatch[1]);
    const second = Number(numericMatch[2]);
    const year = Number(numericMatch[3]);
    const month = first > 12 ? second : first;
    const day = first > 12 ? first : second;
    return toIsoDate(year, month, day);
  }

  const monthFirstMatch = new RegExp(
    String.raw`^(${MONTH_NAMES})\s+(\d{1,2}),?\s+(\d{4})$`,
    "i",
  ).exec(normalized);
  if (monthFirstMatch) {
    const month =
      MONTH_NAMES.split("|").findIndex(
        (name) => name.toLowerCase() === monthFirstMatch[1].toLowerCase(),
      ) + 1;
    return toIsoDate(Number(monthFirstMatch[3]), month, Number(monthFirstMatch[2]));
  }

  const dayFirstMatch = new RegExp(
    String.raw`^(\d{1,2})\s+(${MONTH_NAMES})\s+(\d{4})$`,
    "i",
  ).exec(normalized);
  if (dayFirstMatch) {
    const month =
      MONTH_NAMES.split("|").findIndex(
        (name) => name.toLowerCase() === dayFirstMatch[2].toLowerCase(),
      ) + 1;
    return toIsoDate(Number(dayFirstMatch[3]), month, Number(dayFirstMatch[1]));
  }

  return null;
}

function extractDate(text: string): string | null {
  for (const pattern of DATE_PATTERNS) {
    pattern.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(text)) !== null) {
      const parsed = parseDateValue(match[1]);
      if (parsed) return parsed;
    }
  }
  return null;
}

export async function scrapeUrl(url: string): Promise<ScrapedResult> {
  const initialUrl = await validateScrapeUrl(url);
  let currentUrl = initialUrl;
  const signal = AbortSignal.timeout(SCRAPE_TIMEOUT_MS);

  try {
    let res: Response;
    for (let redirectCount = 0; ; redirectCount += 1) {
      res = await fetch(currentUrl, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (compatible; OpportunityTrackerBot/1.0; +https://replit.com)",
          Accept: "text/html,application/xhtml+xml",
        },
        redirect: "manual",
        signal,
      });

      if (!REDIRECT_STATUSES.has(res.status)) break;

      const location = res.headers.get("location");
      if (!location || redirectCount >= MAX_REDIRECTS) {
        throw new Error("Scrape redirect limit exceeded or redirect location was missing");
      }

      currentUrl = await validateScrapeUrl(new URL(location, currentUrl).href);
    }

    if (!res.ok) {
      logger.warn({ status: res.status, url: currentUrl.href }, "Scrape HTTP error");
      return {
        title: null,
        deadline: null,
        summary: null,
        keyActionSteps: null,
        actionPlanTasks: [],
        type: "job",
        scrapeSuccess: false,
      };
    }

    const html = await res.text();
    return parseScrapedHtml(initialUrl.href, html);
  } catch (err) {
    if (err instanceof UnsafeScrapeUrlError) {
      throw err;
    }
    logger.warn({ err, url: currentUrl.href }, "Scraping failed");
    return {
      title: null,
      deadline: null,
      summary: null,
      keyActionSteps: null,
      actionPlanTasks: [],
      type: "job",
      scrapeSuccess: false,
    };
  }
}
