import * as cheerio from "cheerio";
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
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; OpportunityTrackerBot/1.0; +https://replit.com)",
        Accept: "text/html,application/xhtml+xml",
      },
      signal: AbortSignal.timeout(15000),
    });

    if (!res.ok) {
      logger.warn({ status: res.status, url }, "Scrape HTTP error");
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
    logger.warn({ err, url }, "Scraping failed");
    return { title: null, deadline: null, summary: null, keyActionSteps: null, scrapeSuccess: false };
  }
}
