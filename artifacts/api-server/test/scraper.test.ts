import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, it } from "node:test";
import {
  cleanupTitle,
  cleanSummary,
  detectActionPlanTasks,
  parseScrapedHtml,
  resolveOpportunityTitle,
} from "../src/lib/scraper.ts";

async function fixture(name: string): Promise<string> {
  return readFile(new URL(`./fixtures/${name}`, import.meta.url), "utf8");
}

describe("scraper metadata fallbacks", () => {
  it("maps common submission deliverables to Action Plan tasks", () => {
    const tasks = detectActionPlanTasks(
      "Resume/CV, cover letter, personal statement, audition video, " +
        "headshot and portfolio, references, proposal essay, demo, and code sample.",
    );

    assert.deepEqual(tasks, [
      "Update and tailor CV/Resume",
      "Draft cover letter / application statement",
      "Record & submit video reel / audition recording",
      "Prepare high-res headshot / portfolio links",
      "Gather professional reference contacts",
      "Draft project proposal / essay response",
      "Prepare project demo or code sample",
    ]);
  });

  it("returns an empty Action Plan when no deliverables are mentioned", () => {
    assert.deepEqual(
      detectActionPlanTasks("Applications are open until the deadline."),
      [],
    );
  });

  it("detects singing competitions from page titles and text", () => {
    const result = parseScrapedHtml(
      "https://opportunities.example.org/open-call",
      "<html><head><title>Vocal Talent Call</title></head><body><h1>Annual singing competition</h1></body></html>",
    );

    assert.equal(result.type, "singing-competition");
  });

  it("detects casting opportunities and grants from page text", () => {
    const casting = parseScrapedHtml(
      "https://opportunities.example.org/audition",
      "<html><body><h1>Performer audition</h1><p>Submit your role proposal.</p></body></html>",
    );
    const grant = parseScrapedHtml(
      "https://opportunities.example.org/funding",
      "<html><body><h1>Community funding</h1><p>Grant proposal applications are open.</p></body></html>",
    );

    assert.equal(casting.type, "casting");
    assert.equal(grant.type, "grant");
  });

  it("defaults an unspecified opportunity to a job", () => {
    const result = parseScrapedHtml(
      "https://opportunities.example.org/open-call",
      "<html><head><title>Community opportunity</title></head><body><p>Apply online.</p></body></html>",
    );

    assert.equal(result.type, "job");
  });

  it("keeps meaningful Open Graph title and summary metadata", async () => {
    const result = parseScrapedHtml(
      "https://opportunities.example.org/community-grant",
      await fixture("metadata-fallbacks.html"),
    );

    assert.equal(result.title, "Community Innovation Grant");
    assert.equal(
      result.summary,
      "A grant supporting community-led climate solutions.",
    );
  });

  it("uses a meaningful Twitter title when Open Graph metadata is generic", async () => {
    const result = parseScrapedHtml(
      "https://www.linkedin.com/jobs/view/987654321",
      await fixture("twitter-title-fallback.html"),
    );

    assert.equal(result.title, "Research Fellowship — LinkedIn");
    assert.equal(result.deadline, "2027-01-15");
  });

  it("uses the first heading when metadata and the document title are generic", async () => {
    const result = parseScrapedHtml(
      "https://forms.gle/example-form",
      await fixture("heading-title-fallback.html"),
    );

    assert.equal(result.title, "Open Source Fellowship 2027");
    assert.equal(
      result.summary,
      "Applications are open to contributors building accessible software.",
    );
  });

  it("returns blank summaries for generic Airtable, LinkedIn, and Google Forms copy", async () => {
    const cases = [
      ["airtable-generic.html", "https://airtable.com/appABC123"],
      ["linkedin-generic.html", "https://www.linkedin.com/jobs/view/123456789"],
      ["google-forms-generic.html", "https://forms.gle/example-form"],
    ] as const;

    for (const [filename, url] of cases) {
      const result = parseScrapedHtml(url, await fixture(filename));
      assert.equal(result.summary, null, filename);
    }
  });

  it("preserves a useful description after inspecting metadata candidates", () => {
    assert.equal(
      cleanSummary(
        "  Funding is available for student-led accessibility projects.  ",
      ),
      "Funding is available for student-led accessibility projects.",
    );
    assert.equal(cleanSummary(""), null);
  });
});

describe("provider fallback titles", () => {
  it("normalizes a LinkedIn numeric job path", async () => {
    const result = parseScrapedHtml(
      "https://www.linkedin.com/jobs/view/123456789",
      await fixture("linkedin-generic.html"),
    );

    assert.equal(result.title, "LinkedIn Job 123456789");
  });

  it("normalizes an Airtable base path", async () => {
    const result = parseScrapedHtml(
      "https://airtable.com/appABC123",
      await fixture("airtable-generic.html"),
    );

    assert.equal(result.title, "Airtable Form Application");
  });

  it("normalizes an Airtable form path", () => {
    assert.equal(
      resolveOpportunityTitle(
        "https://airtable.com/shrExample123",
        "Airtable",
        null,
      ),
      "Airtable Form Application",
    );
  });

  it("preserves an explicit Airtable title", () => {
    assert.equal(
      resolveOpportunityTitle(
        "https://airtable.com/shrExample123",
        "2027 Accessibility Fellowship Application",
        null,
      ),
      "2027 Accessibility Fellowship Application",
    );
  });

  it("removes provider-owned title suffixes before fallback resolution", () => {
    assert.equal(cleanupTitle("Airtable | Everyone's app platform"), null);
    assert.equal(
      cleanupTitle("Opportunity details | LinkedIn"),
      "Opportunity details",
    );
  });
});
