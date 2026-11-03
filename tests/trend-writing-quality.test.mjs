import assert from 'node:assert/strict';
import {test} from 'node:test';
import {WRITING_POLICY,draftDigest,validateWritingReview,auditWritingDensity,sealWritingReview} from '../lib/trend-writing-quality.ts';
const context={revision_id:'00000000-0000-0000-0000-000000000001',input_hash:'a'.repeat(64),content_text:'Official source with substantive findings. '.repeat(50)};
function sample(){
 const d={title_ko:'기관, 개인정보 처리 지침 발표',summary_ko:'기관, 해당 처리의 적용 범위와 보호조치 안내',details_ko:'- 기관은 공공기관의 민원정보 처리에 적용할 보호조치를 안내\n\n- 지침은 부서별 접근권한과 개인정보 보유기간의 정기 점검을 요구',evidence:[{quote:'Official source with substantive findings.',locator:'본문 첫 문장',claim:'지침 발표'}]};
 d.writing_review={instruction_hashes:WRITING_POLICY.instruction_hashes,policy_id:'privacy-report-ko-48-reference-v2',source_revision_id:context.revision_id,input_hash:context.input_hash,article_type:'brief_notice',source_reading:{url:'https://example.org/official',locator:'공식 공지 본문 시작부터 마지막 문단까지',read_scope:'full_official_body',reviewed_at:new Date().toISOString()},supplements:[],coverage:['context','action','scope','grounds','follow_up'].map(aspect=>({aspect,status:'covered',evidence_indices:[0],detail:'테스트 원문의 적용 주체와 조치 내용을 대조한 검토 기록'})),editorial_review:Object.fromEntries(['content','flow','legal_stage','terminology','numbers_dates','reader_notes'].map(k=>[k,'테스트용 원문과 원고의 해당 항목을 직접 대조한 구체적인 검토 기록'])),brevity_reason:'원문에서 새로 알린 조치와 적용 범위만 확인되며 연결 문서를 확인해도 추가적인 실질 내용이 없어 간결하게 작성'};
 return sealWritingReview(d);
}
test('required review binds policy, exact source and entire Korean draft',()=>{
 const d=sample();assert.deepEqual(validateWritingReview(d,context),[]);
 for(const mutation of [x=>delete x.writing_review,x=>x.writing_review.policy_id='old',x=>x.writing_review.input_hash='b'.repeat(64),x=>x.writing_review.source_revision_id='other',x=>x.details_ko+=' 수정']){
  const x=structuredClone(d);mutation(x);assert.ok(validateWritingReview(x,context).length);
 }
 assert.equal(d.writing_review.draft_hash,draftDigest(d));
});
test('checkboxes, missing dimensions, invented evidence indices and inaccessible critical attachments fail',()=>{
 for(const mutation of [x=>x.writing_review.editorial_review.content=true,x=>x.writing_review.coverage.pop(),x=>x.writing_review.coverage[0].evidence_indices=[8],x=>x.writing_review.supplements=[{url:'https://example.org/report',status:'unavailable',material:true,reason:'보고서의 핵심 분석 내용을 확인할 수 없어 작성 범위가 확정되지 않은 상태'}],x=>x.writing_review.source_reading.read_scope='rss_summary']){
  const x=sample();mutation(x);assert.ok(validateWritingReview(x,context).length);
 }
});
test('short complete announcements are allowed, rich-source compression needs explanation instead of padding',()=>{
 const d=sample();assert.deepEqual(validateWritingReview(d,context),[]);
 delete d.writing_review.brevity_reason;assert.ok(validateWritingReview(d,context).some(x=>x.includes('brevity_reason')));
 assert.deepEqual(validateWritingReview(d,{...context,content_text:'A genuinely short official announcement.'}),[]);
});
test('content-specific type requires additional dimensions; source absence needs specific reason',()=>{
 const d=sample();d.writing_review.article_type='report';assert.ok(validateWritingReview(d,context).some(x=>x.includes('method')));
 for(const aspect of ['method','findings','limits'])d.writing_review.coverage.push({aspect,status:'not_applicable',reason:'이 공지는 자료 발간 소식만 제시하며 조사 방법과 수치를 별도로 공개하지 않은 것으로 확인'});
 assert.deepEqual(validateWritingReview(d,context),[]);
 d.writing_review.coverage.find(x=>x.aspect==='action').status='not_applicable';assert.ok(validateWritingReview(d,context).length);
});
test('auditing old editorial samples yields review signals, not semantic approval or forced length',()=>{
 const warnings=auditWritingDensity({details_ko:'- 짧은 공지'},2000);assert.ok(warnings.length);
 assert.deepEqual(auditWritingDensity({details_ko:'- 짧은 공지'},100),[]);
});

test('writer packet embeds exact current instructions and invalid templates cannot pass as review',async()=>{
 const {createWritingPacket}=await import('../scripts/trend-writing-packet.mjs');
 const claim={...context,official_url:'https://example.org/official'};
 const packet=createWritingPacket({status:'claimed',jobs:[claim]});
 assert.equal(packet.documents.length,3);assert.ok(packet.documents[0].text.includes('privacy-report-ko-48-reference-v2'));
 assert.equal(packet.review_template.input_hash,context.input_hash);
 const d=sample();d.writing_review=packet.review_template;assert.ok(validateWritingReview(d,context).length);
 assert.throws(()=>createWritingPacket([claim,claim]),/1건/);
});

test('every known attachment receives a review classification and partial material reads stay blocked',()=>{
 const url='https://example.org/linked-report.pdf';
 const c={...context,metadata:{related_documents:[{url,read:false}],unread_attachments:[url]}};
 const d=sample();assert.ok(validateWritingReview(d,c).some(x=>x.includes('known_attachment')));
 d.writing_review.supplements=[{url,status:'read',material:true,read_scope:'partial',complete:false,locator:'실제로는 보고서 첫 쪽만 열람하고 나머지 핵심 분석 쪽은 확보하지 못한 상태',reason:'기사의 핵심 분석을 이해하는 데 필요한 보고서'}];
 assert.ok(validateWritingReview(d,c).some(x=>x.includes('supplements')));
 d.writing_review.supplements[0]={url,status:'not_material',material:false,reason:'이 링크는 같은 페이지의 일반 행사 안내이며 본 기사의 조치·판단 근거와 무관함'};
 assert.deepEqual(validateWritingReview(d,c),[]);
});
