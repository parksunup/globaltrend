import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { findLegalArticlePreview, listLegalTranslationEntries, listLegalTranslations, loadLegalTranslation } from "../lib/legal-translation-review.ts";

test("one review UI discovers multiple law translations and keeps their text separate", () => {
  const root = mkdtempSync(join(tmpdir(), "globaltrend-legal-review-"));
  try {
    const dir = join(root, "data", "legal", "translations");
    mkdirSync(dir, { recursive: true });
    for (const id of ["appi", "pipl"]) {
      writeFileSync(join(dir, `${id}.json`), JSON.stringify({
        official_name: `Official ${id}`,
        source: { selected_revision_enforcement_date: "2026-01-01" },
        translation: { human_review_status: "not_started" },
        provisions: [
          { node_id: `${id}-a1`, parent_id: "main", tag: "Article", number: "1", scope: "main", source_order: 1, korean_title: "제1조" },
          { node_id: `${id}-a1-p1`, parent_id: `${id}-a1`, tag: "Paragraph", number: "1", scope: "main", source_order: 2, korean_text: `${id} 번역 본문` },
        ],
      }), "utf8");
    }
    assert.deepEqual(listLegalTranslations(root).map((law) => law.id), ["appi", "pipl"]);
    assert.equal(loadLegalTranslation("appi", root)?.sections[0].lines[0].text, "appi 번역 본문");
    assert.equal(loadLegalTranslation("pipl", root)?.sections[0].lines[0].text, "pipl 번역 본문");
    assert.equal(loadLegalTranslation("../appi", root), null);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("invalid law file is visible as an error while valid laws remain readable", () => {
  const root = mkdtempSync(join(tmpdir(), "globaltrend-legal-errors-"));
  try {
    const dir = join(root, "data", "legal", "translations");
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "gdpr.json"), "{broken");
    writeFileSync(join(dir, "pipl.json"), JSON.stringify({
      provisions: [{ node_id: "a1", tag: "Article", scope: "main", source_order: 1, korean_text: "본문" }]
    }));
    const entries = listLegalTranslationEntries(root);
    assert.deepEqual(entries.map((entry) => entry.id), ["gdpr", "pipl"]);
    assert.match(entries[0].error, /JSON/);
    assert.deepEqual(listLegalTranslations(root).map((entry) => entry.id), ["pipl"]);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("related article preview uses the cited paragraph and never substitutes another one", () => {
  const law = {
    sections: [{
      id: "main-a2", group: "main", title: "제2조", context: "본칙", reviewStatus: "not_started",
      lines: [
        { id: "main-a2-p1", label: "1항", text: "첫 번째 항의 한국어 번역" },
        { id: "main-a2-p2", label: "2항", text: "두 번째 항의 한국어 번역" },
      ],
    }],
  };
  assert.deepEqual(findLegalArticlePreview(law, "제2조 제2항"), {
    text: "두 번째 항의 한국어 번역", anchorId: "main-a2-p2",
  });
  assert.deepEqual(findLegalArticlePreview(law, "제2조"), {
    text: "첫 번째 항의 한국어 번역", anchorId: "main-a2",
  });
  assert.equal(findLegalArticlePreview(law, "제2조 제3항"), null);
  assert.equal(findLegalArticlePreview(law, "제3조 제1항"), null);
});
