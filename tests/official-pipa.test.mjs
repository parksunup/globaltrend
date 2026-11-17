import assert from "node:assert/strict";
import { test } from "node:test";
import { loadOfficialPipa } from "../lib/official-pipa.ts";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { citedLegalPreview } from "../lib/legal-release.ts";

test("the Korean original includes the selected Act's main articles and supplementary provisions", () => {
  const law = loadOfficialPipa();
  const main = law.sections.filter((section) => section.group === "main");
  const supplementary = law.sections.filter((section) => section.group === "supplementary");
  assert.equal(law.version, "2026-09-11");
  assert.equal(main.length, 127);
  assert.equal(law.sections.filter((section) => section.group === "reference").length, 9);
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


test("uncertain prior Korean provisions remain readable with an edition warning", () => {
  const law = loadOfficialPipa();
  const reference = law.sections.find(section => section.id === "pipa-제28조의12");
  assert.equal(reference.group, "reference");
  assert.equal(reference.reviewStatus, "source_verification_pending");
  assert.match(reference.context, /현재 적용 조문으로 확인한 것은 아니/);
  assert.ok(reference.lines.some(line => line.text.includes("인공지능기술 개발")));
  assert.ok(!law.sections.find(section => section.id === "pipa-제2조").lines.some(line => line.text.includes("인공지능기술")));
  const preview = citedLegalPreview(law, "제28조의12");
  assert.equal(preview.anchorId, reference.id);
  assert.match(preview.text, /판본 대조 참고/);
});


test("rebuilding the Korean original cannot discard preserved edition references", () => {
  const root = mkdtempSync(join(tmpdir(), "pipa-reference-guard-"));
  try {
    mkdirSync(join(root, "data/legal/official"), {recursive:true});
    const path = join(root, "data/legal/official/pipa-20260911.json");
    const original = JSON.stringify({sections:[{id:"prior-reference",group:"reference",lines:["보존할 기존 본문"]}]});
    writeFileSync(path, original);
    writeFileSync(join(root,"source.html"), "<html></html>");
    const result = spawnSync(process.execPath,[resolve("scripts/build-pipa-official.mjs"),join(root,"source.html")],{cwd:root,encoding:"utf8"});
    assert.notEqual(result.status,0);
    assert.match(result.stderr,/판본 대조 참고 자료/);
    assert.equal(readFileSync(path,"utf8"),original);
  } finally {rmSync(root,{recursive:true,force:true});}
});
