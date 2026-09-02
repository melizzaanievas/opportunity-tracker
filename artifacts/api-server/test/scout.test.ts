import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { formatScoutAlert, type ScoutPosting } from "../src/lib/scout.ts";

describe("job scout Telegram alerts", () => {
  it("formats a safe HTML alert with the durable callback id", () => {
    const posting: ScoutPosting = {
      sourceId: "remoteok-123",
      source: "Remote OK",
      title: "<Marketing Lead>",
      company: "Example & Co",
      url: "https://example.com/jobs/123?ref=scout&team=web3",
      description: "Own ecosystem growth <with> a global team.",
      location: "Remote APAC",
      jobType: "full-time",
    };

    const text = formatScoutAlert(posting, 42);

    assert.match(text, /Job Scout Match/);
    assert.match(text, /&lt;Marketing Lead&gt;/);
    assert.match(text, /Example &amp; Co/);
    assert.match(text, /href="https:\/\/example.com\/jobs\/123\?ref=scout&amp;team=web3"/);
    assert.doesNotMatch(text, /<Marketing Lead>/);
  });
});