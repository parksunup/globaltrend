import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { test } from 'node:test';
import { withStoryPublication, publicationLabel } from '../lib/publication-status.ts';
import { loadSubmittedStories } from '../lib/public-submission-preview.ts';
import { buildLegalReviewPackages, reviewedDraftLegalBundle } from '../lib/legal-release.ts';

const stories = loadSubmittedStories();
const packages = buildLegalReviewPackages();
const translated = packages.find(p => p.document?.sections.some(section => section.lines.length));

function hashPackage(body) {
  const { contentHash, ...content } = body;
  return createHash('sha256').update(JSON.stringify(content)).digest('hex');
}

test('actual editorial copy inherits publication only when all compared content matches', () => {
  assert.ok(stories.length > 0);
  const submitted = stories[0];
  const live = { ...structuredClone(submitted), id: 'database-report-id' };
  const result = withStoryPublication([submitted], [live]);
  assert.equal(result[0].publicationStatus, 'published');
  assert.equal(result[0].id, submitted.id);
  assert.equal(submitted.publicationStatus, undefined);
});

for (const [field, change] of [
  ['title', value => `${value} 수정`],
  ['summary', value => `${value} 수정`],
  ['details', value => `${value}\n수정한 본문입니다.`],
  ['originalTitle', value => `${value} revised`],
  ['date', () => '2099.01.01'],
  ['jurisdictions', value => [...(value ?? []), 'TEST-REGION']],
  ['tags', value => [...value, '추가 태그']],
]) {
  test(`a changed ${field} cannot inherit the previous story version's published status`, () => {
    const live = structuredClone(stories[0]);
    const submitted = { ...structuredClone(live), [field]: change(live[field]) };
    const before = structuredClone({ submitted, live });
    assert.equal(withStoryPublication([submitted], [live])[0].publicationStatus, 'draft');
    assert.deepEqual({ submitted, live }, before);
  });
}

test('an unrelated official URL cannot establish publication for identical copy', () => {
  const live = structuredClone(stories[0]);
  const submitted = { ...live, officialUrl: 'https://example.test/different-official-record' };
  assert.equal(withStoryPublication([submitted], [live])[0].publicationStatus, 'draft');
});

test('unavailable publication lookup differs from a successful lookup with no matching records', () => {
  const submitted = { ...stories[0], publicationStatus: 'published' };
  assert.equal(withStoryPublication([submitted], null)[0].publicationStatus, 'unknown');
  assert.equal(withStoryPublication([submitted], [])[0].publicationStatus, 'draft');
});

test('all actual legal review package hashes cover their full review content', () => {
  assert.equal(packages.length, 7);
  for (const p of packages) {
    assert.equal(p.contentHash, hashPackage(p), p.recordId);
  }
});

test('only the matching published legal package gains reviewed status throughout its reader', () => {
  assert.ok(translated);
  const row = { status: 'published', review_payload: structuredClone(translated) };
  const before = structuredClone(row);
  const result = reviewedDraftLegalBundle([row]);
  assert.equal(result.cells.length, 119);
  assert.equal(result.instruments.length, 7);
  assert.equal(result.documents.length, 6);
  assert.equal(result.instruments.find(p => p.id === translated.instrument.id).status, 'published');
  assert.ok(result.cells.filter(cell => cell.jurisdiction === translated.jurisdiction).every(cell => cell.status === 'published'));
  assert.ok(result.cells.filter(cell => cell.jurisdiction !== translated.jurisdiction).every(cell => cell.status !== 'published'));
  const document = result.documents.find(doc => doc.id === translated.document.id);
  assert.equal(document.reviewStatus, 'published');
  assert.ok(document.sections.every(section => section.reviewStatus === 'published'));
  assert.deepEqual(row, before);
});

test('publication of an earlier translated body cannot mark changed repository text as reviewed', () => {
  const previous = structuredClone(translated);
  const section = previous.document.sections.find(s => s.lines.length);
  section.lines[0].text += '\n이전 판본에만 있는 문장입니다.';
  previous.contentHash = hashPackage(previous);
  assert.notEqual(previous.contentHash, translated.contentHash);
  const result = reviewedDraftLegalBundle([{ status: 'published', review_payload: previous }]);
  const document = result.documents.find(doc => doc.id === translated.document.id);
  assert.notEqual(document.reviewStatus, 'published');
  assert.ok(document.sections.every(s => s.reviewStatus !== 'published'));
  assert.ok(result.cells.filter(cell => cell.jurisdiction === translated.jurisdiction).every(cell => cell.status === 'unreviewed'));
  assert.equal(result.instruments.find(p => p.id === translated.instrument.id).status, 'unreviewed');
  assert.deepEqual(document.sections, translated.document.sections);
});

test('publication of an earlier comparison summary does not confer review on the current package', () => {
  const previous = structuredClone(translated);
  previous.cells[0].summary += ' 이전 비교 해설';
  previous.contentHash = hashPackage(previous);
  assert.notEqual(previous.contentHash, translated.contentHash);
  const result = reviewedDraftLegalBundle([{ status: 'published', review_payload: previous }]);
  assert.equal(result.documents.find(doc => doc.id === translated.document.id).reviewStatus, translated.document.reviewStatus);
  assert.ok(result.cells.every(cell => cell.status === 'unreviewed'));
});

test('an edited DB translation cannot confer publication using its stale original content hash', () => {
  const edited = structuredClone(translated);
  edited.document.sections.find(s => s.lines.length).lines[0].text += ' DB에서 수정된 번역';
  assert.equal(edited.contentHash, translated.contentHash);
  assert.notEqual(hashPackage(edited), translated.contentHash);
  const result = reviewedDraftLegalBundle([{ status: 'published', review_payload: edited }]);
  assert.notEqual(result.documents.find(doc => doc.id === translated.document.id).reviewStatus, 'published');
  assert.ok(result.cells.filter(cell => cell.jurisdiction === translated.jurisdiction).every(cell => cell.status === 'unreviewed'));
});

test('an edited DB comparison cannot confer publication using its stale original content hash', () => {
  const edited = structuredClone(translated);
  edited.cells[0].summary += ' DB에서 수정된 비교 내용';
  const result = reviewedDraftLegalBundle([{ status: 'published', review_payload: edited }]);
  assert.equal(result.instruments.find(p => p.id === translated.instrument.id).status, 'unreviewed');
  assert.notEqual(result.documents.find(doc => doc.id === translated.document.id).reviewStatus, 'published');
});

test('JSONB object key reordering does not invalidate an identical published legal package', () => {
  function reorder(value) {
    if (Array.isArray(value)) return value.map(reorder);
    if (value && typeof value === 'object') {
      return Object.fromEntries(Object.entries(value).reverse().map(([key, item]) => [key, reorder(item)]));
    }
    return value;
  }
  const jsonbPayload = reorder(translated);
  assert.notEqual(JSON.stringify(jsonbPayload), JSON.stringify(translated));
  assert.deepEqual(jsonbPayload, translated);
  const result = reviewedDraftLegalBundle([{ status: 'published', review_payload: jsonbPayload }]);
  assert.equal(result.documents.find(doc => doc.id === translated.document.id).reviewStatus, 'published');
});

for (const status of ['draft', 'verified', 'superseded']) {
  test(`a ${status} legal DB version cannot confer published status even with an identical hash`, () => {
    const result = reviewedDraftLegalBundle([{ status, review_payload: translated }]);
    assert.ok(result.cells.every(cell => cell.status === 'unreviewed'));
    assert.ok(result.instruments.every(instrument => instrument.status === 'unreviewed'));
    assert.ok(result.documents.every(document => document.reviewStatus !== 'published'));
  });
}

test('failed legal DB lookup marks every retained draft unknown without losing text', () => {
  const result = reviewedDraftLegalBundle(null);
  assert.equal(result.cells.length, 119);
  assert.equal(result.documents.length, 6);
  assert.ok(result.cells.every(cell => cell.status === 'unknown'));
  assert.ok(result.instruments.every(instrument => instrument.status === 'unknown'));
  assert.ok(result.documents.every(document => document.reviewStatus === 'unknown' && document.sections.every(section => section.reviewStatus === 'unknown')));
  const document = result.documents.find(doc => doc.id === translated.document.id);
  assert.deepEqual(document.sections.flatMap(s => s.lines), translated.document.sections.flatMap(s => s.lines));
});

test('a published DB row without a payload cannot mark any local law as published', () => {
  const result = reviewedDraftLegalBundle([{ status: 'published', review_payload: null }]);
  assert.ok(result.cells.every(cell => cell.status === 'unreviewed'));
  assert.ok(result.instruments.every(instrument => instrument.status === 'unreviewed'));
});

test('publication labels distinguish confirmed publication, drafts, and failed lookups', () => {
  assert.equal(publicationLabel('published'), '검수 완료 · 발행됨');
  assert.equal(publicationLabel('unreviewed'), '미발행 작업본');
  assert.equal(publicationLabel('verified'), '검수 완료 · 미발행');
  assert.equal(publicationLabel('unknown'), '발행 상태 확인 필요');
  assert.equal(publicationLabel(undefined), '발행 상태 확인 필요');
});
