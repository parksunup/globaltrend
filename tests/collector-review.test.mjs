import test from 'node:test';
import assert from 'node:assert/strict';
import { collectorFeedbackId, canReviewCollector, parseCollectorReview } from '../lib/collector-review.ts';

test('reviewers can inspect collector data without database administration or editing rights',()=>{
  assert.equal(canReviewCollector('reviewer'),true);
  assert.equal(canReviewCollector('editor'),true);
  assert.equal(canReviewCollector('admin'),true);
  assert.equal(canReviewCollector(null),false);
  assert.equal(canReviewCollector('visitor'),false);
});
test('feedback follows the exact item and original revision independent of app deployments',()=>{
  const a=collectorFeedbackId('item-1','revision-1');
  assert.equal(a,collectorFeedbackId('item-1','revision-1'));
  assert.notEqual(a,collectorFeedbackId('item-1','revision-2'));
  assert.notEqual(a,collectorFeedbackId('item-2','revision-1'));
});
test('invalid database responses do not appear as an empty successful list',()=>{
  assert.throws(()=>parseCollectorReview(null));
  assert.throws(()=>parseCollectorReview({items:'bad'}));
  assert.deepEqual(parseCollectorReview({items:[],limit:100,database_bytes:123}).items,[]);
});
