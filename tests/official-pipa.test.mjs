import assert from "node:assert/strict";
import { test } from "node:test";
import { loadOfficialPipa } from "../lib/official-pipa.ts";
import { citedLegalPreview } from "../lib/legal-release.ts";

test("the Korean original includes the selected Act's main articles and supplementary provisions", () => {
  const law = loadOfficialPipa();
  const main = law.sections.filter((section) => section.group === "main");
  const supplementary = law.sections.filter((section) => section.group === "supplementary");
  assert.equal(law.version, "2026-09-11");
  assert.equal(main.length, 131);
  assert.equal(supplementary.length, 13);
  assert.match(main[0].lines[0].text, /개인의 자유와 권리를 보호/);
  assert.match(supplementary.at(-1).title, /법률 제21445호/);
  assert.ok(main.every((section) => section.lines.length > 0));
});

test("a comparison citation opens the matching Korean article", () => {
  const preview = citedLegalPreview(loadOfficialPipa(), "제1조");
  assert.equal(preview?.anchorId, "pipa-제1조");
  assert.match(preview?.text ?? "", /제1조\(목적\)/);
});
