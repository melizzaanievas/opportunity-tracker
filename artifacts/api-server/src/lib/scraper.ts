import * as cheerio from "cheerio";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { logger } from "./logger";

interface ScrapedResult {
  title: string | null;
  deadline: string | null;
  summary: string | null;
  keyActionSteps: string | null;
  scrapeSuccess: boolean;
}

const DATE_PATTERNS = [
  // "Due: January 15, 2025" or "Deadline: Jan 15, 2025"
  /(?:due|deadline|closes?|apply\s+by|submission\s+date|applications?\s+due)[:\s]+([A-Z][a-z]+ \d{1,2},?\s+\d{4})/gi,
  // "15 January 2025"
  /(\d{1,2}\s+(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{4})/gi,
  // "2025-01-15" or "01/15/2025" or "01-15-2025"
  /\b(\d{4}-\d{2}-\d{2})\b/g,
  /\b(\d{2}\/\d{2}\/\d{4})\b/g,
];

const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);
const MAX_REDIRECTS = 5;
const SCRAPE_TIMEOUT_MS = 15000;

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

function extractDate(text: string): string | null {
  for (const pattern of DATE_PATTERNS) {
    pattern.lastIndex = 0;
    const match = pattern.exec(text);
    if (match) {
      try {
        const parsed = new Date(match[1]);
        if (!isNaN(parsed.getTime())) {
          return parsed.toISOString().slice(0, 10);
        }
      } catch {
        // ignore parse errors
      }
    }
  }
  return null;
}

function cleanText(text: string): string {
  return text.replace(/\s+/g, " ").trim();
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
      return { title: null, deadline: null, summary: null, keyActionSteps: null, scrapeSuccess: false };
    }

    const html = await res.text();
    const $ = cheerio.load(html);

    // Remove noise
    $("script, style, nav, footer, header").remove();

    // Title
    const ogTitle = $('meta[property="og:title"]').attr("content");
    const twitterTitle = $('meta[name="twitter:title"]').attr("content");
    const htmlTitle = $("title").text();
    const h1 = $("h1").first().text();
    const title = cleanText(ogTitle ?? twitterTitle ?? h1 ?? htmlTitle ?? "");

    // Summary
    const ogDesc = $('meta[property="og:description"]').attr("content");
    const metaDesc = $('meta[name="description"]').attr("content");
    const firstPara = $("article p, main p, .content p, p").first().text();
    const summary = cleanText(ogDesc ?? metaDesc ?? firstPara ?? "").slice(0, 500) || null;

    // Full body text for deadline extraction
    const bodyText = $("body").text();

    // Deadline
    const deadline = extractDate(bodyText);

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
      scrapeSuccess: !!(title || summary),
    };
  } catch (err) {
    if (err instanceof UnsafeScrapeUrlError) {
      throw err;
    }
    logger.warn({ err, url: currentUrl.href }, "Scraping failed");
    return { title: null, deadline: null, summary: null, keyActionSteps: null, scrapeSuccess: false };
  }
}
