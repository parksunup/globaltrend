import test from 'node:test';
import assert from 'node:assert/strict';
import {readAllPages} from '../lib/read-all-pages.ts';

test('public trend pagination reads every published report beyond the former 100-row cap', async () => {
  const reports = Array.from({length: 1158}, (_, index) => ({id: String(index)}));
  const offsets = [];
  const loaded = await readAllPages(async (offset, count) => {
    offsets.push(offset);
    assert.equal(count, 500);
    return reports.slice(offset, offset + count);
  });
  assert.deepEqual(offsets, [0, 500, 1000]);
  assert.deepEqual(loaded, reports);
});

test('an exact page multiple requires one empty final page and does not repeat rows', async () => {
  const reports = Array.from({length: 1000}, (_, index) => ({id: String(index)}));
  const loaded = await readAllPages(async (offset, count) => reports.slice(offset, offset + count));
  assert.deepEqual(loaded, reports);
});
