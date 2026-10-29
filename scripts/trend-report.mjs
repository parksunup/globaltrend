import {readFileSync,readdirSync,writeFileSync} from 'node:fs';
import {validateTrendReport} from '../lib/trend-report-format.ts';
import {writePacket,sealDraft,claimContext,validateWritingReview,auditWritingDensity} from './trend-writing-packet.mjs';
const [mode,file]=process.argv.slice(2);
if(mode==='--packet' && file){
 const out=process.argv[process.argv.indexOf('--out')+1];
 if(!process.argv.includes('--out')||!out)throw new Error('--packet claim.json --out work/packet.json 필요');
 writePacket(file,out);console.log('정확한 원문·작성 지침·용어집 패킷 생성. 실제 원문 열람·작성·검토는 별도로 수행하세요.');
}else if(mode==='--seal' && file){
 sealDraft(file);console.log('현재 원고 해시 기록. 검토 내용을 생성하거나 사실 확인을 대신하지 않습니다.');
}else if(mode==='--check' && file){
 const draft=JSON.parse(readFileSync(file,'utf8'));
 const sourceFile=process.argv.includes('--source')?process.argv[process.argv.indexOf('--source')+1]:null;
 const context=sourceFile?claimContext(JSON.parse(readFileSync(sourceFile,'utf8'))):undefined;
 const errors=[...validateTrendReport(draft),...validateWritingReview(draft,context)];
 if(errors.length){console.error(errors.join('\n'));process.exitCode=1;}
 else console.log('원고 형식·작성 검토 기록 검사 통과. 내용의 정확성·문장 품질·사람 승인은 별도 검수입니다.');
}else if(mode==='--audit'){
 const drafts=JSON.parse(readFileSync('data/trends/editorial/report-drafts.json','utf8')).items;
 const sources=readdirSync('data/trends/fixtures').filter(f=>f.endsWith('.json')).flatMap(f=>JSON.parse(readFileSync(`data/trends/fixtures/${f}`,'utf8')).items);
 const result=drafts.map(d=>{const source=sources.find(x=>x.record_id===d.record_id);return {record_id:d.record_id,details_chars:d.details_ko.length,source_fields:Object.keys(source||{}),source_body_available:!!(source?.content_text||source?.full_text),warnings:(source?.content_text||source?.full_text)?auditWritingDensity(d,String(source.content_text||source.full_text).length):['저장소 fixture에 원문 전문이 없어 정보 누락·분량 적정성은 공식 원문 재대조 필요'],new_policy_review_present:!!d.writing_review};});
 console.log(JSON.stringify({policy_id:'privacy-report-ko-48-reference-v2',count:result.length,meaning:'기존 자료의 검토 신호이며 전수 윤문·사실 확인 완료가 아님',items:result},null,2));
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
  const lines=['# 수집 동향 전체 보고서 편집본','',`총 ${drafts.length}건 · 기존 편집 표본 · 사람 검수 전 초안 · 최신 자동작성 기준 privacy-report-ko-48-reference-v2(이 파일의 전수 재작성·의미 검수 완료를 뜻하지 않음)`,'','수록 순서는 출처별 정리이며 실제 주간호 선정·발행 순서가 아닙니다. 원문·날짜·확인 범위·근거·보류 사유는 fixtures의 원 조사 기록을 함께 확인합니다.',''];
  for(const [index,draft] of drafts.entries()){
   const raw=sourceById.get(draft.record_id);
   lines.push(`## ${index+1}. ${draft.title_ko}`,'',`자료 ID: \`${draft.record_id}\``,'',`**${draft.summary_ko}**`,'',draft.details_ko,'',`출처: [${raw.original_title}](${raw.official_url}) · ${raw.organization.join(' · ')} · ${raw.source_published_date}`,'');
  }
  writeFileSync('data/trends/editorial/report-drafts.md',lines.join('\n'));
  console.log(`${drafts.length}건 보고서 Markdown 생성`);
 }else console.log(`${drafts.length}건 ID 대응·기존 형식 검사 통과. 신규 정책의 의미 검토·윤문 완료를 뜻하지 않습니다.`);
}else{console.error('Usage: node scripts/trend-report.mjs --packet claim.json --out work/packet.json | --seal draft.json | --check draft.json --source claim.json | --audit | --corpus | --render');process.exitCode=1;}
