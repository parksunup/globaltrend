import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { listLegalTranslations, loadLegalTranslation } from "../lib/legal-translation-review.ts";

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
