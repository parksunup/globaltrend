import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildLegalReviewPackages, publishedLegalBundle, citedLegalPreview } from '../lib/legal-release.ts';
import { loadLegalTranslation } from '../lib/legal-translation-review.ts';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

test('seven immutable packages retain 119 cells and six translated bodies including GDPR HTML export', () => {
  const packages = buildLegalReviewPackages();
  assert.equal(packages.length, 7);
  assert.equal(packages.reduce((n, p) => n + p.cells.length, 0), 119);
  assert.equal(packages.filter(p => p.document).length, 6);
  for (const p of packages) {
    assert.equal(p.cells.length, 17);
    assert.match(p.contentHash, /^[a-f0-9]{64}$/);
    assert.equal(p.contentHash, buildLegalReviewPackages().find(q => q.recordId === p.recordId).contentHash);
    assert.ok(p.cells.every(c => c.jurisdiction === p.jurisdiction));
  }
  assert.equal(packages.find(p => p.jurisdiction === 'EU').document.articleCount, 99);
  assert.equal(packages.find(p => p.jurisdiction === 'EU').document.sections.filter(s=>s.id.startsWith('recital-')).length, 173);
  assert.equal(packages.find(p => p.jurisdiction === 'KR').availability, 'official_index');
});

test('only published versions yield public cells and text; no repository draft fallback', () => {
  const p = buildLegalReviewPackages().find(p => p.jurisdiction === 'JP');
  assert.equal(publishedLegalBundle([{status:'draft', review_payload:p}]).cells.length, 0);
  const bundle = publishedLegalBundle([{status:'published', review_payload:p}]);
  assert.equal(bundle.cells.length, 17);
  assert.equal(bundle.documents[0].reviewStatus, 'published');
  assert.ok(bundle.documents[0].sections.every(s => s.reviewStatus === 'published'));
  assert.equal(p.document.reviewStatus, 'not_started');
});

test('UK recital/reference text survives legal reader composition', () => {
  const law = loadLegalTranslation('uk-gdpr');
  assert.ok(law.sections.some(s => s.group === 'reference' && s.lines.length));
  assert.ok(law.sections.some(s => s.group === 'appendix'));
});

test('citations use the actual section, not array positions or a different statute', () => {
  const ca = loadLegalTranslation('ccpa');
  assert.equal(citedLegalPreview(ca, '1798.140(v)').anchorId, 'main-a1798-140');
  const sg = loadLegalTranslation('pdpa');
  assert.equal(citedLegalPreview(sg, '일반 규칙 제16조'), null);
  assert.equal(citedLegalPreview(sg, '제15A조').anchorId, 'main-a15A');
  assert.equal(citedLegalPreview(loadLegalTranslation('pipl'), '네트워크 데이터 안전관리 조례 제62조'), null);
  assert.equal(citedLegalPreview(sg, 'Act 2/2026 제8조'), null);
  assert.equal(citedLegalPreview(sg, '2020 개정법 제14조(현행 통합본 미편입)'), null);
  assert.equal(citedLegalPreview(loadLegalTranslation('uk-gdpr'), 'S.I. 2026/82 제2(j)·제4·제5조'), null);
  const nested = citedLegalPreview(ca, '1798.199.90');
  assert.ok(nested === null || nested.anchorId === 'main-a1798-199-90');
});

test('normalized GDPR retains the committed export and index provenance', () => {
  const corpus = JSON.parse(readFileSync('data/derived/gdpr.json','utf8'));
  for(const key of ['html','index']) {
    assert.equal(createHash('sha256').update(readFileSync(corpus.export_provenance[key],'utf8').replaceAll('\r\n','\n')).digest('hex'), corpus.export_provenance[`${key}_sha256`]);
  }
  assert.equal(corpus.provisions.length,1123);
  assert.ok(corpus.provisions.every(node => node.human_review_status === 'not_started'));
});
