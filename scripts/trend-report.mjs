import {readFileSync,readdirSync,writeFileSync} from 'node:fs';
import {validateTrendReport} from '../lib/trend-report-format.ts';
const [mode,file]=process.argv.slice(2);
if(mode==='--check' && file){
 const draft=JSON.parse(readFileSync(file,'utf8'));
 const errors=validateTrendReport(draft);
 if(errors.length){console.error(errors.join('\n'));process.exitCode=1;}
 else console.log('보고서 문체·구조 검사 통과. 사실·근거 검수는 별도 수행합니다.');
}else if(mode==='--corpus' || mode==='--render'){
 const path='data/trends/editorial/report-drafts.json';
 const drafts=JSON.parse(readFileSync(path,'utf8')).items;
 const sources=readdirSync('data/trends/fixtures').filter(f=>f.endsWith('.json')).flatMap(f=>JSON.parse(readFileSync(`data/trends/fixtures/${f}`,'utf8')).items);
 const sourceById=new Map(sources.map(item=>[item.record_id,item]));
 const ids=new Set();
 const errors=[];
 for(const draft of drafts){
  if(ids.has(draft.record_id))errors.push(`${draft.record_id}: 중복 편집본`);
  ids.add(draft.record_id);
  if(!sourceById.has(draft.record_id))errors.push(`${draft.record_id}: 수집 자료 없음`);
  errors.push(...validateTrendReport(draft).map(error=>`${draft.record_id}: ${error}`));
 }
 for(const item of sources)if(!ids.has(item.record_id))errors.push(`${item.record_id}: 보고서 편집본 누락`);
 if(errors.length){console.error(errors.join('\n'));process.exitCode=1;}
 else if(mode==='--render'){
  const lines=['# 수집 동향 전체 보고서 편집본','',`총 ${drafts.length}건 · 사람 검수 전 초안 · 문체 기준 privacy-report-ko-2026-10`,'','수록 순서는 출처별 정리이며 실제 주간호 선정·발행 순서가 아닙니다. 원문·날짜·확인 범위·근거·보류 사유는 fixtures의 원 조사 기록을 함께 확인합니다.',''];
  for(const [index,draft] of drafts.entries()){
   const raw=sourceById.get(draft.record_id);
   lines.push(`## ${index+1}. ${draft.title_ko}`,'',`자료 ID: \`${draft.record_id}\``,'',`**${draft.summary_ko}**`,'',draft.details_ko,'',`출처: [${raw.original_title}](${raw.official_url}) · ${raw.organization.join(' · ')} · ${raw.source_published_date}`,'');
  }
  writeFileSync('data/trends/editorial/report-drafts.md',lines.join('\n'));
  console.log(`${drafts.length}건 보고서 Markdown 생성`);
 }else console.log(`${drafts.length}건 전수 편집 및 보고서 형식 검사 통과`);
}else{console.error('Usage: node scripts/trend-report.mjs --corpus | --render | --check draft.json');process.exitCode=1;}
