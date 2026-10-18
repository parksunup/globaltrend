import {test} from 'node:test';
import assert from 'node:assert/strict';
import {loadWeeklySample} from '../lib/weekly-sample.ts';
test('weekly example retains seven matching items and does not turn into a real issue',()=>{
 const sample=loadWeeklySample();
 assert.equal(sample.stories.length,7);
 assert.equal(new Set(sample.stories.map(s=>s.id)).size,7);
 assert.ok(sample.stories.every(s=>s.officialUrl.startsWith('https://')));
});

test('weekly example exposes a report-shaped issue for every selected item',()=>{
 const sample=loadWeeklySample();
 assert.equal(sample.issue.sections.length,2);
 assert.equal(sample.issue.contents.length,7);
 assert.ok(sample.issue.contents.every(item=>item.leadSummary && item.bodyPoints.length>0 && item.sourceLabel));
 assert.equal(sample.issue.contents[0].bodyPoints[0].label,'상태·대상');
 assert.ok(sample.issue.contents.every(item=>item.originalTitle && item.officialUrl.startsWith('https://')));
});
