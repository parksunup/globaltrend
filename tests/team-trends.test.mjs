import test from 'node:test';
import assert from 'node:assert/strict';
import {composeTeamTrends,parseTrendEdit,loadTeamTrendRows} from '../lib/team-trends.ts';
import {canPublishTeamTrend} from '../lib/team-trend-publication.ts';
const id='12345678-1234-1234-1234-123456789abc';
const row={id,revision:'a'.repeat(32),title_ko:'원래 제목',summary_ko:'요약',details_ko:'본문',official_url:'https://example.test/one',original_title:'Original',source_name:'기관',published_date:'2026-10-01',jurisdictions:[],topics:[],status:'draft'};
const snapshot={items:[],commitSha:'c'.repeat(40)};
const edit={report_id:id,base_revision:row.revision,title_ko:'수정 제목',summary_ko:'수정 요약',details_ko:'수정 본문'};
test('all DB drafts are reviewable; GitHub edits change only workspace composition, not originals',()=>{
  const result=composeTeamTrends([row],snapshot,[parseTrendEdit(edit)]);
  assert.equal(result.items[0].title_ko,'수정 제목');assert.equal(result.items[0].editState,'applied');assert.equal(row.title_ko,'원래 제목');
});
test('changed DB revision preserves and displays a conflict instead of silently overwriting newer content',()=>{
  const result=composeTeamTrends([{...row,revision:'b'.repeat(32)}],snapshot,[edit]);
  assert.equal(result.items[0].title_ko,'원래 제목');assert.equal(result.items[0].proposedEdit.title_ko,'수정 제목');assert.equal(result.warnings.length,1);
});
test('publishing may change the revision without creating a false conflict when the edited text is already saved',()=>{
  const published={...row,status:'published',revision:'b'.repeat(32),title_ko:edit.title_ko,summary_ko:edit.summary_ko,details_ko:edit.details_ko};
  const result=composeTeamTrends([published],snapshot,[edit]);
  assert.equal(result.items[0].editState,'synced');
  assert.equal(result.warnings.length,0);
  assert.equal(canPublishTeamTrend(result.items[0]),false);
});
test('a newer Codex edit on a published report is eligible for public content refresh',()=>{
  const result=composeTeamTrends([{...row,status:'published'}],snapshot,[edit]);
  assert.equal(result.items[0].editState,'applied');
  assert.equal(canPublishTeamTrend(result.items[0]),true);
  assert.equal(canPublishTeamTrend({...row,status:'published',editState:'conflict'}),false);
});
test('DB and GitHub copies of one official URL are deduplicated; new articles still appear',()=>{
  const item={kind:'동향 표본',id:'fixture-one',title:'제목',summary:'요약',fields:[],links:[{label:'공식 원문',url:row.official_url}]};
  assert.equal(composeTeamTrends([row],{...snapshot,items:[item]},[]).items.length,1);
  assert.equal(composeTeamTrends([row],{...snapshot,items:[{...item,links:[]}]},[]).items.length,2);
});
test('staff edit files cannot publish, alter official sources, or replace someone else’s identity',()=>{
  assert.throws(()=>parseTrendEdit({...edit,status:'published'}),/다섯/);assert.throws(()=>parseTrendEdit({...edit,report_id:'../../bad'}),/ID/);
  assert.throws(()=>composeTeamTrends([row],snapshot,[edit,edit]),/중복/);
});
test('RPC pagination includes every draft and strips internal fields without any DB administrator key',async()=>{
  const rows=await loadTeamTrendRows({url:'https://example.test',key:'publishable-test',fetch:async(_url,init)=>{
    const {p_offset}=JSON.parse(init.body);const item={...row,id:p_offset?'second':id,reviewed_by:'private',content_text:'private raw source'};
    return Response.json({items:[item],total:2,nextOffset:p_offset?null:1});
  }});
  assert.equal(rows.length,2);assert.equal('reviewed_by' in rows[0],false);assert.equal('content_text' in rows[0],false);
});
