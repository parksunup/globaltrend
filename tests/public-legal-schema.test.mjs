import assert from 'node:assert/strict';
import { test } from 'node:test';
import { isMissingLegalReviewPayload } from '../lib/public-legal-schema.ts';

test('recognizes only the absent legal review payload column', () => {
  assert.equal(isMissingLegalReviewPayload({
    code: '42703',
    message: 'column law_versions.review_payload does not exist',
  }), true);
  assert.equal(isMissingLegalReviewPayload({ code: '42703', message: 'column "review_payload" does not exist' }), true);
  assert.equal(isMissingLegalReviewPayload({ code: '42703', message: 'column law_versions.other_column does not exist' }), false);
  assert.equal(isMissingLegalReviewPayload({ code: '42501', message: 'permission denied' }), false);
});
