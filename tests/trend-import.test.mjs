import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { loadTrendImportCandidates } from "../lib/trend-import.ts";

function withSubmittedFiles(run, weeklyOverrides = {}) {
  const root = mkdtempSync(join(tmpdir(), "globaltrend-import-"));
  const directory = join(root, "data", "trends");
  mkdirSync(join(directory, "fixtures"), { recursive: true });
  const selected = {
    entry_id: "weekly-example-edpb-1", fixture_record_id: "edpb-1", source_id: "edpb",
    official_url: "https://example.org/selected", source_published_date: "2026-09-21",
    key_points_ko: ["핵심 내용"], privacy_significance: { text_ko: "검토할 의미" },
    ...weeklyOverrides,
  };
  writeFileSync(join(directory, "weekly-sample.json"), JSON.stringify({ entries: [selected] }));
  writeFileSync(join(directory, "fixtures", "edpb.json"), JSON.stringify({ items: [
    { record_id: "edpb-1", original_title: "Original title", korean_title: "한국어 제목",
      summary_ko: "한국어 요약", official_url: "https://example.org/selected",
      source_published_date: "2026-09-21", jurisdictions: ["EU"], topic_tags: ["GDPR"] },
    { record_id: "edpb-2", original_title: "Excluded sample", korean_title: "제외",
      summary_ko: "제외 요약", official_url: "https://example.org/excluded",
      source_published_date: "2026-09-20" },
  ] }));
  try { run(root); } finally { rmSync(root, { recursive: true, force: true }); }
}

test("only weekly-selected matching source items become editable draft candidates", () => {
  withSubmittedFiles((root) => {
    assert.deepEqual(loadTrendImportCandidates(root), [{
      id: "edpb-1", source: "edpb", originalTitle: "Original title", title: "한국어 제목",
      summary: "한국어 요약", details: "핵심 내용\n\n검토할 의미",
      officialUrl: "https://example.org/selected", publishedDate: "2026-09-21",
      jurisdictions: ["EU"], topics: ["GDPR"],
    }]);
  });
});

test("a weekly entry with a conflicting official URL cannot be imported", () => {
  withSubmittedFiles((root) => assert.deepEqual(loadTrendImportCandidates(root), []), {
    official_url: "https://example.org/different",
  });
});

test("missing submitted trend files do not create candidates", () => {
  assert.deepEqual(loadTrendImportCandidates(join(tmpdir(), "globaltrend-nonexistent")), []);
});
