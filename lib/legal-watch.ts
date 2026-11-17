import type {LegalReviewPackage} from './legal-release';
export type WatchChanges={added:string[];removed:string[];modified:string[];metadataChanged:boolean};
export type WatchEvent={id:string;kind:'source_changed'|'baseline_review';createdAt:string;beforeDigest:string|null;afterDigest:string;changes:WatchChanges;reviewed:boolean};
export type WatchLaw={id:string;jurisdiction:string;name:string;url:string;scope:string;checkedAt:string;status:'changed'|'unchanged'|'baseline'|'partial'|'error';error:string|null;version?:string;coverage?:string;articleCount?:number;digest?:string;baselineOrigin:string;lastSuccessAt?:string|null;acquiredUrl?:string;primaryError?:string|null;events:WatchEvent[]};
export type WatchReport={schemaVersion:1;generatedAt:string;sourceCommit:string;laws:WatchLaw[]};
export type WatchSource={id:string;jurisdiction:string;name:string;url:string;scope:string;parser:string;allowedHosts?:string[]};
const hash=(v:unknown)=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v);
const string=(v:unknown,max=1000)=>typeof v==='string'&&v.length<=max;
const list=(v:unknown)=>Array.isArray(v)&&v.length<=12000&&v.every(x=>string(x,240));
export function validateWatchReport(value:unknown,sources:WatchSource[]):WatchReport{
 const r=value as WatchReport;if(!r||r.schemaVersion!==1||!Number.isFinite(Date.parse(r.generatedAt))||!Array.isArray(r.laws)||r.laws.length!==sources.length||!/^([a-f0-9]{40})?$/.test(r.sourceCommit))throw Error('invalid_report');
 const seen=new Set<string>();for(const law of r.laws){const source=sources.find(s=>s.id===law.id);if(!source||seen.has(law.id)||law.url!==source.url||!['changed','unchanged','baseline','partial','error'].includes(law.status)||!string(law.error??'',100)||!string(law.version??'',300)||!Number.isFinite(Date.parse(law.checkedAt))||!Array.isArray(law.events)||law.events.length>1000)throw Error('invalid_law_report');seen.add(law.id);
  if(law.acquiredUrl){const u=new URL(law.acquiredUrl);if(u.protocol!=='https:'||u.username||u.password||u.port||!(source.allowedHosts??[new URL(source.url).hostname]).includes(u.hostname))throw Error('invalid_official_body_url');}
  for(const e of law.events){if(!hash(e.id)||!hash(e.afterDigest)||(e.beforeDigest!==null&&!hash(e.beforeDigest))||!['source_changed','baseline_review'].includes(e.kind)||typeof e.reviewed!=='boolean'||!e.changes||!list(e.changes.added)||!list(e.changes.removed)||!list(e.changes.modified)||typeof e.changes.metadataChanged!=='boolean')throw Error('invalid_event');}
  // Configuration is trusted; artifact names and links are never used as arbitrary HTML or fetch targets.
  law.name=source.name;law.jurisdiction=source.jurisdiction;law.scope=source.scope;
 }
 return r;
}
export const pendingEvents=(law:WatchLaw)=>law.events.filter(e=>!e.reviewed);
function tokens(value:string):string[]{
 const ko=[...value.matchAll(/제\s*(\d+(?:\.\d+)*(?:조의\d+|의\d+)?)\s*조(?:의(\d+))?/g)].map(m=>(m[1]+(m[2]?'-'+m[2]:'' )).replace(/조의|의/g,'-'));
 return [...new Set([...ko,...[...value.matchAll(/(?:Article\s*|section\s*)?(\d+(?:\.\d+)*[A-Za-z]?)/gi)].map(m=>m[1].toLowerCase())])];
}
export function lawImpact(law:WatchLaw,p:LegalReviewPackage|undefined){
 const events=pendingEvents(law),ids=[...new Set(events.flatMap(e=>[...e.changes.added,...e.changes.removed,...e.changes.modified]))];
 const main=ids.filter(id=>id.startsWith('main:')).map(id=>id.slice(5).toLowerCase().replaceAll('_','-'));
 const fullReview=events.some(e=>e.kind==='baseline_review'||e.changes.metadataChanged||e.changes.added.length||e.changes.removed.length)||ids.some(id=>!id.startsWith('main:'))||Boolean(law.coverage&&law.coverage!=='article_text');
 const cells=(p?.cells??[]).filter(c=>fullReview||c.articleNumbers.some(citation=>tokens(citation).some(number=>main.includes(number))));
 const unmapped=main.filter(number=>!cells.some(c=>c.articleNumbers.some(citation=>tokens(citation).includes(number))));
 return {ids,fullReview:fullReview||unmapped.length>0,unmapped,cells:unmapped.length?(p?.cells??[]):cells};
}
export function reviewPacket(law:WatchLaw,p:LegalReviewPackage|undefined,report:WatchReport){
 const impact=lawImpact(law,p);
 const request=`저는 법제 담당입니다. 기존 담당 브랜치 feat/legal-corpus-foundation에서 기존 작업을 먼저 보존하고 진행해 주세요.\n${law.name}의 공식 출처 변경 후보를 확인해 번역·비교표 수정안을 작성해 주세요. 변경 감지는 법률 개정의 확정이나 번역 검수 완료가 아닙니다.\n공식 출처: ${law.url}\n점검 시각: ${law.checkedAt}\n점검 범위: ${law.scope}\n상태: ${law.status}${law.error?' / '+law.error:''}\n조문 식별자: ${impact.ids.join(', ')||'초기 판본·원문 구조 확인 필요'}\n영향 후보 비교 기준: ${impact.cells.map(c=>c.criterionName).join(', ')||'관련 기준 전체 대조 필요'}\n${impact.fullReview?'부칙·판본·미매핑 조항 또는 초기 점검이 포함되어 전체 영향 범위를 검토해야 합니다.':''}\n먼저 공식 본문과 현행·시행예정 판본을 대조하고, 번역 전문과 비교표를 각각 검토해 주세요. 조문 ID·원문 구조·조건·예외·수치·기한·출처를 보존하고 용어집을 적용하세요. data/legal/translations/<법률ID>.json과 대응 Markdown, data/legal/criteria-mapping.csv와 대응 Markdown을 함께 갱신하세요. 공개된 판본·진행 중 작업과 충돌하면 자동 덮어쓰지 마세요. 미확인 항목과 실패 원인을 기록하고 검수 완료로 표시하지 마세요. npm run validate:data 등 관련 검사 후 담당 브랜치에 commit/push하고 작업실에서 내용을 확인하세요. 사람 검토와 기존 수정본 공개 절차로 넘기되 PR 병합·운영 DB 직접 수정·자동 공개는 하지 마세요.\n기존 자료는 아래 패킷의 링크에서 전문을 읽으세요. 원문을 확인하지 않고 새 번역을 추정해 쓰지 마세요.`;
 return {schemaVersion:1,status:'draft_requires_source_check_and_human_review',lawId:law.id,createdAt:report.generatedAt,monitorCommit:report.sourceCommit,source:{url:law.url,acquiredUrl:law.acquiredUrl??null,primaryError:law.primaryError??null,version:law.version??null,coverage:law.coverage??'unavailable',digest:law.digest??null,baselineOrigin:law.baselineOrigin},events:pendingEvents(law),basePayloadHash:p?.contentHash??null,translation:{path:law.id==='pipa'?'data/legal/official/pipa-20260911.json':`data/legal/translations/${law.id}.json`,url:`https://github.com/parksunup/globaltrend/blob/feat/legal-corpus-foundation/${law.id==='pipa'?'data/legal/official/pipa-20260911.json':`data/legal/translations/${law.id}.json`}`,existingVersion:p?.versionLabel??null},comparison:{path:'data/legal/criteria-mapping.csv',fullReview:impact.fullReview,unmapped:impact.unmapped,cells:impact.cells.map(c=>({id:c.id,criterion:c.criterionName,articleNumbers:c.articleNumbers,existingSummary:c.summary,existingExceptions:c.exceptions,sourceVersion:c.sourceVersion}))},review:{translationReviewed:false,comparisonReviewed:false,published:false},request};
}
