import assert from "node:assert/strict";
import { test } from "node:test";
import { join } from "node:path";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { loadSubmissionDocuments, loadSubmissionPreview } from "../lib/submission-preview.ts";

const root = join(import.meta.dirname, "fixtures", "submission-preview");

test("PR branch deliverables are visible without a database import", () => {
  const items = loadSubmissionPreview(root);
  assert.equal(items.length, 5);
  assert.equal(items.filter((item) => item.group === "legal").length, 2);
  assert.equal(items.filter((item) => item.group === "trends").length, 3);
  assert.equal(items.find((item) => item.id === "legal-jp-appi")?.subtitle, "Act on the Protection of Personal Information, Japan");
  assert.equal(items.find((item) => item.id === "fixture-edpb-edpb-example")?.summary, "한국어 요약");
  assert.equal(items.find((item) => item.id === "weekly-sample")?.status, "draft");
  assert.equal(items.find((item) => item.id === "legal-appi-translation")?.fields.find((field) => field.label === "원문 확보")?.value, "false");
  assert.match(items.find((item) => item.id === "legal-appi-translation")?.summary ?? "", /58\/185조/);
});

test("missing submitted files do not create fake entries", () => {
  assert.deepEqual(loadSubmissionPreview(join(import.meta.dirname, "fixtures", "missing")), []);
  assert.deepEqual(loadSubmissionDocuments(join(import.meta.dirname, "fixtures", "missing")), { legal: [], weekly: null });
});

test("committed comparison cells and weekly entries become readable review documents", () => {
  const documents = loadSubmissionDocuments(root);
  assert.equal(documents.legal.length, 2);
  assert.equal(documents.legal[0].criterionName, "개인정보 범위");
  assert.deepEqual(documents.legal[0].articleNumbers, ["제2조", "제58조의2"]);
  assert.equal(documents.weekly?.entries.length, 1);
  assert.equal(documents.weekly?.entries[0].facts, "원문에서 확인한 사실");
  assert.equal(documents.weekly?.entries[0].id, "weekly-entry-1");
});

test("new official source files and every sample appear without changing the UI code", () => {
  const fixtureRoot = mkdtempSync(join(tmpdir(), "trend-preview-"));
  try {
    const configs = join(fixtureRoot, "data", "trends", "source-configs");
    const fixtures = join(fixtureRoot, "data", "trends", "fixtures");
    mkdirSync(configs, { recursive: true });
    mkdirSync(fixtures, { recursive: true });
    writeFileSync(join(configs, "cnil.json"), JSON.stringify({
      source_id: "cnil", organization: "CNIL", review_status: "unreviewed",
      start_url: "https://www.cnil.fr/fr/actualites"
    }));
    writeFileSync(join(fixtures, "cnil.json"), JSON.stringify({
      source_id: "cnil", items: [
        { record_id: "one", korean_title: "첫째", official_url: "https://www.cnil.fr/fr/one" },
        { record_id: "two", korean_title: "둘째", official_url: "https://www.cnil.fr/fr/two" }
      ]
    }));
    writeFileSync(join(fixtures, "ftc.json"), JSON.stringify({
      source_id: "ftc", items: [
        { record_id: "three", korean_title: "셋째", official_url: "https://www.ftc.gov/three" }
      ]
    }));
    const items = loadSubmissionPreview(fixtureRoot);
    assert.equal(items.filter((item) => item.kind === "수집 출처").length, 1);
    assert.equal(items.filter((item) => item.kind === "동향 표본").length, 3);
    assert.deepEqual(items.filter((item) => item.kind === "동향 표본").map((item) => item.id), [
      "fixture-cnil-one", "fixture-cnil-two", "fixture-ftc-three"
    ]);
  } finally {
    rmSync(fixtureRoot, { recursive: true, force: true });
  }
});
