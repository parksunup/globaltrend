import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {WRITING_POLICY,sealWritingReview,validateWritingReview,auditWritingDensity} from '../lib/trend-writing-quality.ts';
export function claimContext(raw){
 const rows=Array.isArray(raw)?raw:Array.isArray(raw?.jobs)?raw.jobs:[raw];
 if(rows.length!==1||!rows[0]?.revision_id||!rows[0]?.input_hash||!rows[0]?.content_text||!rows[0]?.official_url)throw new Error('정확한 임대 원문 1건의 revision_id/input_hash/content_text/official_url이 필요합니다.');
 return rows[0];
}
export function createWritingPacket(raw){
 const claim=claimContext(raw);
 const documents=WRITING_POLICY.required_documents.map(path=>{const text=readFileSync(path,'utf8');const sha256=createHash('sha256').update(text).digest('hex');if(WRITING_POLICY.instruction_hashes[path]!==sha256)throw new Error('지침 해시가 정책과 다릅니다: '+path);return {path,sha256,text};});
 return {policy:WRITING_POLICY,claim,documents,workflow:['원문 전체와 실질적인 연결 문서를 실제 열람','유형별 핵심 사실을 근거로 구성; 부재는 구체적 이유 기록','한국어 제목·요약·본문 작성 후 내용·흐름·법적 상태·수치·용어 역대조','writing_review를 실제 작성; --seal은 해시만 계산하며 검토 기록을 만들어주지 않음','--check draft.json --source claim.json 실제 통과 후 기존 submit_trend_draft 제출','reports·publication_working_copies의 실제 문자열과 검수 전 상태 재조회'],review_template:{instruction_hashes:WRITING_POLICY.instruction_hashes,policy_id:WRITING_POLICY.policy_id,source_revision_id:claim.revision_id,input_hash:claim.input_hash,article_type:'TODO',source_reading:{url:claim.official_url,read_scope:'TODO',locator:'TODO',reviewed_at:'TODO'},supplements:[],coverage:WRITING_POLICY.common_aspects.map(aspect=>({aspect,status:'TODO',detail:'TODO',evidence_indices:[]})),editorial_review:Object.fromEntries(WRITING_POLICY.editorial_checks.map(k=>[k,'TODO']))}};
}
export function writePacket(input,output){const packet=createWritingPacket(JSON.parse(readFileSync(input,'utf8')));writeFileSync(output,JSON.stringify(packet,null,2)+'\n');return packet;}
export function sealDraft(file){const draft=JSON.parse(readFileSync(file,'utf8'));writeFileSync(file,JSON.stringify(sealWritingReview(draft),null,2)+'\n');}
export {validateWritingReview,auditWritingDensity};
