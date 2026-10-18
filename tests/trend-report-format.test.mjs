import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync,readdirSync} from 'node:fs';
import {loadSubmittedStories} from '../lib/public-submission-preview.ts';
import {loadSubmissionPreview} from '../lib/submission-preview.ts';
import {loadTrendImportCandidates} from '../lib/trend-import.ts';
import {loadWeeklySample} from '../lib/weekly-sample.ts';
import {validateTrendReport} from '../lib/trend-report-format.ts';

const edited=JSON.parse(readFileSync('data/trends/editorial/report-drafts.json','utf8')).items;
test('every collected record has an edited report across search, detail and worker review',()=>{
 const originals=readdirSync('data/trends/fixtures').filter(f=>f.endsWith('.json')).flatMap(f=>JSON.parse(readFileSync(`data/trends/fixtures/${f}`,'utf8')).items);
 assert.equal(edited.length,21);
 assert.deepEqual(edited.map(x=>x.record_id).sort(),originals.map(x=>x.record_id).sort());
 const stories=loadSubmittedStories();
 const review=loadSubmissionPreview().filter(x=>x.kind==='동향 표본');
 for(const draft of edited){
  const story=stories.find(x=>x.id===draft.record_id);
  assert.equal(story.title,draft.title_ko);
  assert.equal(story.summary,draft.summary_ko);
  assert.equal(story.details,draft.details_ko);
  const raw=originals.find(x=>x.record_id===draft.record_id);
  assert.equal(story.officialUrl,raw.official_url);
  const item=review.find(x=>x.id.endsWith('-'+draft.record_id));
  assert.equal(item.summary,draft.summary_ko);
  assert.ok(item.fields.some(x=>x.label==='주요 내용' && x.value===draft.details_ko));
 }
});
test('future drafts must keep a short lead and report bullets instead of embedded review instructions',()=>{
 const valid={title_ko:'기관, 보호조치 안내',summary_ko:'기관, 적용 대상과 보호조치 안내',details_ko:'- (적용 대상) 민간 조직을 대상으로 안내\n\n- (일정) 의견수렴 일정 공개'};
 assert.deepEqual(validateTrendReport(valid),[]);
 assert.ok(validateTrendReport({...valid,summary_ko:'요약\n\n주요 내용\n1. 본문'}).length);
 assert.ok(validateTrendReport({...valid,details_ko:'원문을 정확히 반영하는지 확인합니다.'}).length);
 assert.ok(validateTrendReport({...valid,details_ko:'- (범위) 원문 전문은 검토 필요다'}).length);
 assert.ok(validateTrendReport({...valid,title_ko:''}).length);
 for(const draft of edited) assert.deepEqual(validateTrendReport(draft),[],draft.record_id);
});
test('weekly and editor import use the same revised copy as search',()=>{
 const week=loadWeeklySample();
 for(const item of week.issue.contents){
  const draft=edited.find(x=>x.record_id===item.id);
  assert.equal(item.leadSummary,draft.summary_ko);
  assert.equal(item.title,draft.title_ko);
 }
 for(const item of loadTrendImportCandidates()){
  const draft=edited.find(x=>x.record_id===item.id);
  assert.equal(item.summary,draft.summary_ko);
  assert.equal(item.details,draft.details_ko);
 }
});
