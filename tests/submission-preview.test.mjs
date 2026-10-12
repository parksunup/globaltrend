import assert from "node:assert/strict";
import { test } from "node:test";
import { join } from "node:path";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { loadSubmissionDocuments, loadSubmissionPreview } from "../lib/submission-preview.ts";

const root = join(import.meta.dirname, "fixtures", "submission-preview");

test("PR branch deliverables are visible without a database import", () => {
  const items = loadSubmissionPreview(root);
  assert.equal(items.length, 4);
  assert.equal(items.filter((item) => item.group === "legal").length, 2);
  assert.equal(items.filter((item) => item.group === "trends").length, 2);
  assert.equal(items.find((item) => item.id === "legal-jp-appi")?.subtitle, "Act on the Protection of Personal Information, Japan");
  assert.equal(items.find((item) => item.id === "fixture-edpb-edpb-example")?.summary, "한국어 요약");
  assert.equal(items.some((item) => item.kind === "주간 예시 호"), false);
  assert.equal(items.find((item) => item.id === "legal-appi-translation")?.fields.find((field) => field.label === "원문 확보")?.value, "false");
  assert.match(items.find((item) => item.id === "legal-appi-translation")?.summary ?? "", /58\/185조/);
});

test("missing submitted files do not create fake entries", () => {
  assert.deepEqual(loadSubmissionPreview(join(import.meta.dirname, "fixtures", "missing")), []);
  assert.deepEqual(loadSubmissionDocuments(join(import.meta.dirname, "fixtures", "missing")), { legal: [], weekly: null });
});

test("legal comparison remains readable while weekly example is removed from Preview", () => {
  const documents = loadSubmissionDocuments(root);
  assert.equal(documents.legal.length, 2);
  assert.equal(documents.legal[0].criterionName, "개인정보 범위");
  assert.deepEqual(documents.legal[0].articleNumbers, ["제2조", "제58조의2"]);
  assert.equal(documents.weekly, null);
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

test("new law translations appear in the review inventory and malformed files show an error", () => {
  const fixtureRoot = mkdtempSync(join(tmpdir(), "legal-preview-"));
  try {
    const dir = join(fixtureRoot, "data", "legal", "translations");
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "pipl.json"), JSON.stringify({
      official_name: "Personal Information Protection Law",
      korean_title: "개인정보 보호법",
      source: { original_url: "https://example.invalid/pipl", version_status: "확인됨", full_text_obtained: true },
      translation: { status: "partial_draft", public_release_status: "draft_for_review", translated_main_articles: 1, total_main_articles: 10 },
      coverage: { comparison_status: "in_progress" },
      provisions: [{ node_id: "pipl-a1", tag: "Article", scope: "main", source_order: 1, korean_text: "번역 초안" }]
    }));
    writeFileSync(join(dir, "gdpr.json"), "{broken");
    const items = loadSubmissionPreview(fixtureRoot);
    assert.equal(items.find((item) => item.id === "legal-pipl-translation")?.title, "PIPL · 개인정보 보호법");
    assert.ok(items.find((item) => item.id === "legal-pipl-translation")?.links.some((link) => link.url === "/legal-translation/pipl"));
    assert.equal(items.find((item) => item.id === "legal-gdpr-translation-error")?.status, "error");
  } finally {
    rmSync(fixtureRoot, { recursive: true, force: true });
  }
});

test("comparison links survive CSV parsing and expose only local evidence files", () => {
  const fixtureRoot = mkdtempSync(join(tmpdir(), "legal-links-"));
  try {
    const dir = join(fixtureRoot, "data", "legal");
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "criteria-mapping.csv"),
      "cell_id,criterion_order,criterion_id,criterion_name,jurisdiction_code,article_numbers,korean_summary,major_exceptions,translation_links,official_source_url,source_version,review_status,pending_reason\n" +
      'scope--JP,1,scope,범위,JP,"[""제2조""]",초안,미검토,"[""./translations/appi.md#main-a2"",""../../secret.md""]",https://example.invalid/appi,2026,unreviewed,검수 필요\n');
    assert.deepEqual(loadSubmissionDocuments(fixtureRoot).legal[0].translationLinks, ["./translations/appi.md#main-a2"]);
  } finally {
    rmSync(fixtureRoot, { recursive: true, force: true });
  }
});
