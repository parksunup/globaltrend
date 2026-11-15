import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { LEGAL_CRITERIA_V1, LEGAL_CRITERIA_V2, hasCompleteLegalCriteria } from '../lib/legal-criteria.ts';
import { buildLegalReviewPackages } from '../lib/legal-release.ts';

const cells = (ids) => ids.map(criterionId => ({criterionId}));
test('criterion versions preserve old snapshots and require the exact current set for new imports', () => {
  assert.equal(LEGAL_CRITERIA_V1.length, 17);
  assert.equal(LEGAL_CRITERIA_V2.length, 18);
  assert.deepEqual(LEGAL_CRITERIA_V2.slice(0, 17), LEGAL_CRITERIA_V1);
  assert.ok(hasCompleteLegalCriteria(cells(LEGAL_CRITERIA_V1)));
  assert.ok(!hasCompleteLegalCriteria(cells(LEGAL_CRITERIA_V1), true));
  assert.ok(hasCompleteLegalCriteria(cells([...LEGAL_CRITERIA_V2].reverse()), true));
  assert.ok(!hasCompleteLegalCriteria(cells(LEGAL_CRITERIA_V2.slice(1))));
  assert.ok(!hasCompleteLegalCriteria(cells([...LEGAL_CRITERIA_V2.slice(1), LEGAL_CRITERIA_V2[1]])));
  assert.ok(!hasCompleteLegalCriteria(cells([...LEGAL_CRITERIA_V1, 'unknown'])));
});
test('all seven extraterritorial cells retain distinct evidence and unreviewed status', () => {
  const packages = buildLegalReviewPackages();
  for (const p of packages) {
    assert.ok(hasCompleteLegalCriteria(p.cells, true));
    const cell = p.cells.find(c => c.criterionId === 'extraterritorial_scope');
    assert.equal(cell.criterionOrder, 18);
    assert.equal(cell.status, 'unreviewed');
    assert.ok(cell.summary.length && cell.exceptions.length && cell.sourceUrl.startsWith('https://'));
  }
  const added = packages.map(p => p.cells.find(c => c.criterionId === 'extraterritorial_scope'));
  assert.equal(added.find(c => c.jurisdiction === 'KR').evidenceKind, 'official_guidance');
  assert.match(added.find(c => c.jurisdiction === 'GB').exceptions, /第?2A/);
  assert.match(added.find(c => c.jurisdiction === 'SG').exceptions, /追加|추가 확인/);
});
test('comparison downloads match the canonical corpus', () => {
  for (const ext of ['csv', 'md']) assert.deepEqual(readFileSync(`data/legal/criteria-mapping.${ext}`), readFileSync(`public/review-drafts/criteria-mapping.${ext}`));
});
