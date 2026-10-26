import {createHash} from 'node:crypto';
import type {SupabaseClient} from '@supabase/supabase-js';
import {loadSubmittedStories} from './public-submission-preview.ts';
import {buildLegalReviewPackages} from './legal-release.ts';
import type {WorkspaceKind} from './workspace-model';

export type WorkspaceTrendCandidate = {
 id:string; source:string; originalTitle:string; title:string; summary:string; details:string;
 officialUrl:string; publishedDate:string; jurisdictions:string[]; topics:string[];
};
type Db=Pick<SupabaseClient,'from'|'rpc'>;
type Row=Record<string,unknown>;
const fail=(code:string,message:string)=>Object.assign(new Error(message),{code});
const uuid=(value:unknown):value is string=>typeof value==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(value);
const text=(value:unknown)=>typeof value==='string'?value.trim():'';
const strings=(value:unknown)=>Array.isArray(value)?value.filter((part):part is string=>typeof part==='string'):[];

/** All submitted editorial stories, independent of the weekly example selection. */
export function loadAllTrendImportCandidates(root=process.cwd()):WorkspaceTrendCandidate[] {
 return loadSubmittedStories(root).map(story=>({id:story.id,source:story.institution.toLowerCase(),originalTitle:story.originalTitle,title:story.title,summary:story.summary,details:story.details,officialUrl:story.officialUrl,publishedDate:story.date.replaceAll('.','-'),jurisdictions:story.jurisdictions??[],topics:story.tags}));
}
/** Object key order does not change a JSON snapshot's identity; array order does. */
export function hashSubmission(value:unknown):string {
 const json=JSON.stringify(value,(_key,entry)=>entry&&typeof entry==='object'&&!Array.isArray(entry)?Object.fromEntries(Object.keys(entry).sort().map(key=>[key,entry[key]])):entry);
 if(json===undefined)throw fail('22023','제출 자료의 내용을 확인해 주세요.');
 return createHash('sha256').update(json).digest('hex');
}
function candidatePayload(candidate:WorkspaceTrendCandidate) {
 return {title_ko:candidate.title.trim(),one_line_summary_ko:candidate.summary.trim(),detailed_summary_ko:candidate.details.trim(),jurisdictions:candidate.jurisdictions,topics:candidate.topics};
}
function comparableReport(row:Row) {
 return {title_ko:text(row.title_ko),one_line_summary_ko:text(row.one_line_summary_ko),detailed_summary_ko:text(row.detailed_summary_ko),jurisdictions:strings(row.jurisdictions),topics:strings(row.topics)};
}
function assertReportMatches(row:Row,candidate:WorkspaceTrendCandidate) {
 if(hashSubmission(comparableReport(row))!==hashSubmission(candidatePayload(candidate)))throw fail('40001','이미 등록된 자료의 내용이 제출 파일과 다릅니다. 작업 공간의 최신 자료를 확인해 주세요.');
}
async function workingRevision(db:Db,kind:WorkspaceKind,id:string,expected:unknown) {
 const result=await db.from('publication_working_copies').select('revision,payload,trashed_at').eq('entity_type',kind==='trend'?'report':'law').eq('entity_id',id).maybeSingle();
 if(result.error)throw result.error;
 if(!result.data||!result.data.payload||typeof result.data.payload!=='object'||!/^\d+$/.test(String(result.data.revision)))throw fail('40001','등록된 작업본을 확인하지 못했습니다. 자료 목록을 새로고침해 주세요.');
 if(result.data.trashed_at)throw fail('40001','이미 휴지통에 있는 자료입니다. 작업 공간에서 복원한 뒤 이용해 주세요.');
 if(kind==='trend')assertReportMatches(result.data.payload as Row,expected as WorkspaceTrendCandidate);
 else if(hashSubmission(result.data.payload)!==hashSubmission(expected))throw fail('40001','등록된 법제 수정본이 제출 파일과 다릅니다. 작업 공간의 최신 판본을 확인해 주세요.');
 return {id,revision:String(result.data.revision)};
}
export async function prepareTrendCandidate(db:Db,candidate:WorkspaceTrendCandidate) {
 if(!candidate.originalTitle.trim()||!candidate.title.trim()||!candidate.summary.trim()||!candidate.details.trim()||!/^\d{4}-\d{2}-\d{2}$/.test(candidate.publishedDate))throw fail('22023','제출 동향의 원문 제목·내용·날짜를 확인해 주세요.');
 const acronym=candidate.source==='curia'?'CJEU':candidate.source.toUpperCase();
 const sourceResult=await db.from('sources').select('id,publishers!inner(acronym)').eq('is_active',true).eq('publishers.acronym',acronym).limit(2);
 if(sourceResult.error)throw sourceResult.error;
 if(sourceResult.data?.length!==1)throw fail('22023',sourceResult.data?.length?'같은 기관의 수집 출처가 여러 개입니다. 사용할 출처를 먼저 정리해 주세요.':`${acronym} 출처가 등록되지 않았습니다. 수집 출처를 먼저 등록해 주세요.`);
 const source=sourceResult.data[0];
 async function existing() {
  const original=await db.from('source_items').select('id,title_original,published_at').eq('source_id',source.id).eq('canonical_url',candidate.officialUrl).maybeSingle();
  if(original.error)throw original.error;if(!original.data)return null;
  if(text(original.data.title_original)!==candidate.originalTitle.trim()||text(original.data.published_at).slice(0,10)!==candidate.publishedDate)throw fail('40001','등록된 원문의 제목이나 게시일이 제출 자료와 다릅니다. 원문 기록을 먼저 확인해 주세요.');
  const report=await db.from('reports').select('id,title_ko,one_line_summary_ko,detailed_summary_ko,jurisdictions,topics').eq('source_item_id',original.data.id).maybeSingle();
  if(report.error)throw report.error;if(!report.data)throw fail('40001','같은 원문이 이미 수집되어 있습니다. 해당 원문의 초안 작업 상태를 먼저 확인해 주세요.');
  assertReportMatches(report.data,candidate);return workingRevision(db,'trend',report.data.id,candidate);
 }
 const prior=await existing();if(prior)return prior;
 const created=await db.rpc('create_report_draft',{p_source_id:source.id,p_canonical_url:candidate.officialUrl,p_original_title:candidate.originalTitle,p_title_ko:candidate.title,p_summary_ko:candidate.summary,p_details_ko:candidate.details,p_jurisdictions:candidate.jurisdictions,p_topics:candidate.topics,p_source_published_at:candidate.publishedDate+'T12:00:00Z'});
 if(created.error){if(created.error.code==='23505'){const concurrent=await existing();if(concurrent)return concurrent;}throw created.error;}
 if(!uuid(created.data))throw fail('40001','등록 결과를 확인하지 못했습니다. 자료 목록을 새로고침해 주세요.');
 return workingRevision(db,'trend',created.data,candidate);
}

export async function prepareLegalCandidate(db:Db,candidate:ReturnType<typeof buildLegalReviewPackages>[number]) {
 const result=await db.rpc('import_legal_review',{p_payload:candidate});
 if(result.error){if(result.error.code==='22023'&&/different content/i.test(result.error.message))throw fail('40001','같은 판본으로 등록된 법제 내용이 현재 자료와 다릅니다. 최신 판본을 새로 확인해 주세요.');throw result.error;}
 if(!uuid(result.data))throw fail('40001','법제 등록 결과를 확인하지 못했습니다. 최신 자료를 다시 확인해 주세요.');
 return workingRevision(db,'law',result.data,candidate);
}

/** Import the exact selected repository snapshot, never an unrelated/edited existing draft. */
export async function prepareWorkspaceSubmission(db:Db,kind:WorkspaceKind,id:string,expectedHash:string):Promise<{id:string;revision:string}> {
 if(typeof expectedHash!=='string'||!/^[a-f0-9]{64}$/i.test(expectedHash))throw fail('40001','선택한 자료의 판본을 새로 확인해 주세요.');
 if(typeof id!=='string')throw fail('40001','선택한 자료를 다시 확인해 주세요.');
 if(kind==='trend') {
  if(!id.startsWith('repo-trend:'))throw fail('40001','선택한 동향 자료를 다시 확인해 주세요.');
  const candidate=loadAllTrendImportCandidates().find(item=>item.id===id.slice('repo-trend:'.length));
  if(!candidate||hashSubmission(candidate)!==expectedHash)throw fail('40001','선택한 뒤 제출 자료가 변경됐습니다. 최신 내용을 보고 다시 선택해 주세요.');
  return prepareTrendCandidate(db,candidate);
 }
 if(kind!=='law'||!id.startsWith('repo-law:'))throw fail('40001','선택한 법제 자료를 다시 확인해 주세요.');
 const candidate=buildLegalReviewPackages().find(item=>item.recordId===id.slice('repo-law:'.length));
 if(!candidate||candidate.contentHash!==expectedHash)throw fail('40001','선택한 뒤 법제 제출 판본이 변경됐습니다. 최신 내용을 보고 다시 선택해 주세요.');
 return prepareLegalCandidate(db,candidate);
}
