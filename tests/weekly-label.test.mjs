import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const weeklyLabel=require('../lib/weekly-label.ts');

test('formats Monday-to-Sunday weeks by the month containing Monday',()=>{
 assert.equal(weeklyLabel.formatMonthlyWeek('2026-10-05'),'2026년 10월 1주');
 assert.equal(weeklyLabel.formatMonthlyWeek('2026-10-12'),'2026년 10월 2주');
 assert.equal(weeklyLabel.formatMonthlyWeek('2026-09-28'),'2026년 9월 4주');
 assert.equal(weeklyLabel.formatMonthlyWeek('2025-12-29'),'2025년 12월 5주');
 assert.throws(()=>weeklyLabel.formatMonthlyWeek('2026-10-06'),/Monday/);
 assert.throws(()=>weeklyLabel.formatMonthlyWeek('2026-02-31'),/Invalid week start/);
});

test('monthly identifiers round-trip and old/new podcast keys map to an edition number',()=>{
 assert.equal(weeklyLabel.monthlyWeekIssueKey('2026-10-05'),'2026-10-W1');
 assert.equal(weeklyLabel.podcastIssueKey('2026-10-05',2),'2026-10-W1-2');
 assert.equal(weeklyLabel.podcastEditionNumber('2026-W42'),1);
 assert.equal(weeklyLabel.podcastEditionNumber('2026-W42-2'),2);
 assert.equal(weeklyLabel.podcastEditionNumber('2026-10-W1-2'),2);
});
