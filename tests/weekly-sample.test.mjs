import {test} from 'node:test';
import assert from 'node:assert/strict';
import {loadWeeklySample} from '../lib/weekly-sample.ts';
test('weekly example retains seven matching items and does not turn into a real issue',()=>{
 const sample=loadWeeklySample();
 assert.equal(sample.stories.length,7);
 assert.equal(new Set(sample.stories.map(s=>s.id)).size,7);
 assert.ok(sample.stories.every(s=>s.officialUrl.startsWith('https://')));
});
