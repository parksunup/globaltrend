/** Recorded editorial review, not an automated judgement of factual or literary quality. */
import {createHash} from 'node:crypto';
import policy from '../config/trend-writing-policy.json' with {type:'json'};
export const WRITING_POLICY=policy;
type Obj=Record<string,unknown>;
const object=(v:unknown):Obj=>v!==null && typeof v==='object' && !Array.isArray(v)?v as Obj:{};
const text=(v:unknown,min=12)=>typeof v==='string' && v.trim().length>=min && !/^(?:TODO|TBD|확인 완료|검토 완료|해당 없음)$/i.test(v.trim());
export function draftDigest(input:unknown):string {
 const d=object(input);
 return createHash('sha256').update(['title_ko','summary_ko','details_ko'].map(k=>String(d[k]??'')).join('\n'),'utf8').digest('hex');
}
export function sealWritingReview<T extends Obj>(input:T):T {
 const d=structuredClone(input);if(!d.writing_review || Array.isArray(d.writing_review))throw new Error('writing_review를 실제 작성한 뒤 seal을 실행하세요.');
 object(d.writing_review).draft_hash=draftDigest(d);return d;
}
export function auditWritingDensity(input:unknown,sourceChars:number):string[]{
 const d=object(input), chars=String(d.details_ko??'').length;
 return sourceChars>=policy.thin_draft_warning.source_chars_at_least && chars<policy.thin_draft_warning.details_chars_below
 ? [`원문 ${sourceChars}자 대비 본문 ${chars}자: 누락·의도적 압축을 원문과 재대조하세요. 분량을 채우기 위한 증보는 금지합니다.`]:[];
}
export function validateWritingReview(input:unknown,context?:{revision_id?:string;input_hash?:string;content_text?:string;official_url?:string;metadata?:unknown}):string[]{
 const d=object(input),r=object(d.writing_review),errors:string[]=[];
 for(const [path,hash] of Object.entries(policy.instruction_hashes))if(object(r.instruction_hashes)[path]!==hash)errors.push(`writing_review.instruction_hashes.${path}: 지침 판본 불일치`);
 if(r.policy_id!==policy.policy_id)errors.push('writing_review.policy_id: 최신 작성 지침 판본 필요');
 if(typeof r.source_revision_id!=='string'||!/^[0-9a-f-]{36}$/i.test(r.source_revision_id)||context?.revision_id && r.source_revision_id!==context.revision_id)errors.push('writing_review.source_revision_id: 정확한 원문 판본 필요');
 if(typeof r.input_hash!=='string'||!/^[0-9a-f]{64}$/i.test(r.input_hash)||context?.input_hash && r.input_hash!==context.input_hash)errors.push('writing_review.input_hash: 정확한 원문 해시 필요');
 if(r.draft_hash!==draftDigest(d))errors.push('writing_review.draft_hash: 원고 수정 후 원문 대조·윤문 및 재seal 필요');
 const types=policy.article_types as Record<string,string[]>;
 const kind=typeof r.article_type==='string'?r.article_type:'';
 if(!Object.hasOwn(types,kind))errors.push('writing_review.article_type: 기사 유형 확인');
 const reading=object(r.source_reading);
 if(context && 'official_url' in context && reading.url!==context.official_url)errors.push('writing_review.source_reading.url: 정확한 원문 URL 필요');
 if(!text(reading.url,8)||!/^https:\/\//.test(String(reading.url))||!text(reading.locator)||reading.read_scope!=='full_official_body'||!text(reading.reviewed_at,10)||!Number.isFinite(Date.parse(String(reading.reviewed_at)))||Date.parse(String(reading.reviewed_at))>Date.now()+300000)errors.push('writing_review.source_reading: 공식 원문 전체의 실제 읽은 범위·시각 필요');
 if(!Array.isArray(r.supplements))errors.push('writing_review.supplements: 연결 자료 검토 기록 배열 필요');
 else for(const raw of r.supplements){
  const s=object(raw);
  if(!text(s.url,8)||!/^https:\/\//.test(String(s.url))||typeof s.material!=='boolean'||!['read','unavailable','not_material'].includes(String(s.status))||!text(s.reason)||s.status==='read'&&(!text(s.locator)||s.complete!==true||!['full_document','complete_relevant_sections'].includes(String(s.read_scope)))||s.material===true&&s.status!=='read')errors.push('writing_review.supplements: 핵심 연결 자료 미확보 또는 검토 근거 누락');
 }
 const metadata=object(context?.metadata);
 const known=[...(Array.isArray(metadata.related_documents)?metadata.related_documents:[]),...(Array.isArray(metadata.unread_attachments)?metadata.unread_attachments:[])].map(x=>typeof x==='string'?x:object(x).url).filter(x=>typeof x==='string');
 const classified=Array.isArray(r.supplements)?r.supplements.map(x=>object(x).url):[];
 for(const url of new Set(known))if(!classified.includes(url))errors.push(`writing_review.known_attachment: 관련 자료의 중요도·열람 여부 분류 필요: ${url}`);
 const coverage=Array.isArray(r.coverage)?r.coverage.map(object):[];
 if(!Array.isArray(r.coverage))errors.push('writing_review.coverage: 핵심 사실 검토 기록 필요');
 const required=[...policy.common_aspects,...(types[kind]||[])];
 const evidence=Array.isArray(d.evidence)?d.evidence:[];
 if(new Set(coverage.map(x=>x.aspect)).size!==coverage.length)errors.push('writing_review.coverage: 중복 차원 제거');
 for(const aspect of required){
  const row=coverage.find(x=>x.aspect===aspect);
  if(!row){errors.push(`writing_review.coverage.${aspect}: 내용 충족 또는 구체적 부재 이유 필요`);continue;}
  if(row.status==='covered'){
   if(!text(row.detail)||!Array.isArray(row.evidence_indices)||!row.evidence_indices.length||!row.evidence_indices.every(i=>Number.isInteger(i)&&Number(i)>=0&&Number(i)<evidence.length))errors.push(`writing_review.coverage.${aspect}: 실제 주장·근거 인덱스 필요`);
  }else if(row.status!=='not_applicable'||!text(row.reason)||['action','scope'].includes(aspect))errors.push(`writing_review.coverage.${aspect}: 핵심 조치·대상은 근거로 설명하고 부재는 구체적으로 기록`);
 }
 const editorial=object(r.editorial_review);
 for(const check of policy.editorial_checks)if(!text(editorial[check]))errors.push(`writing_review.editorial_review.${check}: 체크 표시가 아닌 실제 대조·수정 내용 필요`);
 if(context?.content_text && auditWritingDensity(d,context.content_text.length).length && !text(r.brevity_reason,20))errors.push('writing_review.brevity_reason: 충분한 원문을 짧게 압축한 구체적 이유 재검토');
 return errors;
}
