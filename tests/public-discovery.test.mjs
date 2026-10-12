import assert from "node:assert/strict";
import { test } from "node:test";
import { jurisdictionName } from "../lib/jurisdictions.ts";
import { matchesPublicTopic, publicTopics } from "../lib/public-topics.ts";
import { inCustomDateRange } from "../lib/public-search-filters.ts";
import { loadSubmittedStories } from "../lib/public-submission-preview.ts";

test("jurisdiction labels show names, including the EU", () => {
  assert.equal(jurisdictionName("EU"), "유럽연합(EU)");
  assert.equal(jurisdictionName("international:OECD"), "국제기구(OECD)");
  assert.ok(loadSubmittedStories().some((story) => story.jurisdictions?.includes("EU") && story.region.includes("유럽연합(EU)")));
});

test("topic cards represent searchable subjects in the submitted stories", () => {
  const stories = loadSubmittedStories();
  assert.equal(new Set(publicTopics.map((topic) => topic.id)).size, publicTopics.length);
  assert.ok(publicTopics.every((topic) => !["국가", "법제", "주제"].includes(topic.label)));
  assert.ok(stories.some((story) => matchesPublicTopic(story.tags, "ai")));
  assert.ok(stories.some((story) => matchesPublicTopic(story.tags, "rights")));
  assert.equal(matchesPublicTopic(["AI"], "unknown"), false);
});

test("custom date range includes both endpoints and rejects incomplete ranges", () => {
  assert.equal(inCustomDateRange("2025-01-01", "2025-01-01", "2025-12-31"), true);
  assert.equal(inCustomDateRange("2025-12-31", "2025-01-01", "2025-12-31"), true);
  assert.equal(inCustomDateRange("2026-01-01", "2025-01-01", "2025-12-31"), false);
  assert.equal(inCustomDateRange("2025-06-01", "2025-12-31", "2025-01-01"), false);
  assert.equal(inCustomDateRange("2025-06-01", "", "2025-12-31"), false);
});
