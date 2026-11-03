import test from 'node:test';
import assert from 'node:assert/strict';
import {rankWeeklyCandidates,weeklyPriority} from '../lib/weekly-priority.ts';
const candidate=(id,title,documentType,date='2026-10-20')=>({id,title,summary:'요약',details:'본문',date,documentType,topics:[],jurisdictions:[]});
test('policy changes and enforcement outrank newer routine notices without a source quota',()=>{
 const rows=[candidate('new','기관 사무실 주소 안내','news','2026-10-25'),candidate('law','개인정보 보호법 시행 규정 개정','legislation','2026-10-20'),candidate('court','개인정보 유출 판결과 시정','judgment','2026-10-19')];
 assert.deepEqual(rankWeeklyCandidates(rows).map(row=>row.id),['law','court','new']);
 assert.deepEqual(weeklyPriority(rows[1]).reasons,['법·정책 변경','개인정보 처리 영향']);
});
test('equal importance has stable publication-date and id ordering',()=>{
 const rows=[candidate('b','공지','news'),candidate('a','공지','news'),candidate('c','공지','news','2026-10-21')];
 assert.deepEqual(rankWeeklyCandidates(rows).map(row=>row.id),['c','a','b']);
});
