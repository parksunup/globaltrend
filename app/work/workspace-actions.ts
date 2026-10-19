"use server";
import {revalidatePath} from 'next/cache';
import {prepareWorkspaceSubmission} from '../../lib/workspace-submissions';
import {workspaceSession} from '../../lib/workspace-data';
import type {WorkspaceCommand, WorkspaceActionResult} from '../../lib/workspace-model';

const uuid=(v:string)=>/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(v);
const rpcNames={publish:'publish_publication_draft',request_publication:'request_publication_draft',unpublish:'unpublish_publication',trash:'trash_publication_draft',restore:'restore_publication_draft',save_trend:'save_publication_draft'} as const;
export async function executeWorkspaceAction(command:WorkspaceCommand):Promise<WorkspaceActionResult> {
 const targets=command?.targets??[];const failures=(message:string)=>({succeeded:[],failures:targets.map(t=>({key:t.kind+':'+t.id,message}))});
 if(process.env.VERCEL_ENV==='preview')return failures('화면 확인용입니다. 실제 저장은 운영 작업 공간을 이용해 주세요.');
 if(!targets.length||targets.length>100||!Object.hasOwn(rpcNames,command.operation))return failures('자료를 1~100건 선택해 주세요.');
 const {db,canEdit,canPublish}=await workspaceSession();if(!canEdit||(['publish','unpublish'].includes(command.operation)&&!canPublish))return failures('이 작업을 수행할 팀 권한이 없습니다.');
 const result:WorkspaceActionResult={succeeded:[],failures:[]};const seen=new Set<string>();
 const duplicateLaws=new Set<string>();const lawIds=[...new Set(targets.filter(t=>t.kind==='law'&&uuid(t.id)).map(t=>t.id))];
 if(command.operation==='publish'&&lawIds.length>1){const check=await db.from('law_versions').select('id,legal_instrument_id').in('id',lawIds);if(check.error)return failures('법제 판본을 확인하지 못했습니다. 잠시 후 다시 시도해 주세요.');const counts=new Map<string,number>();for(const row of check.data??[])counts.set(row.legal_instrument_id,(counts.get(row.legal_instrument_id)??0)+1);for(const row of check.data??[])if((counts.get(row.legal_instrument_id)??0)>1)duplicateLaws.add(row.id);}
 for(const t of targets){const key=t.kind+':'+t.id;if(seen.has(key))continue;seen.add(key);
  if(duplicateLaws.has(t.id)&&t.kind==='law'){result.failures.push({key,message:'같은 법률은 한 판본만 선택해 공개해 주세요.'});continue;}
  let actual=t;
  if(t.id.startsWith('repo-trend:')||t.id.startsWith('repo-law:')){try{const prepared=await prepareWorkspaceSubmission(db,t.kind,t.id,t.revision);actual={...t,...prepared};}catch{result.failures.push({key,message:'제출 자료가 바뀌었거나 등록할 수 없습니다. 새로고침 후 출처와 내용을 확인해 주세요.'});continue;}}
  if(!uuid(actual.id)||!['trend','law'].includes(actual.kind)||!/^\d+$/.test(actual.revision)||!Number.isSafeInteger(Number(actual.revision))){result.failures.push({key,message:'자료 상태를 새로고침한 뒤 다시 선택해 주세요.'});continue;}
  const params:Record<string,unknown>={p_entity_type:t.kind==='trend'?'report':'law',p_entity_id:actual.id,p_expected_revision:Number(actual.revision)};
  if(command.operation==='save_trend'){
   const d=command.draft;if(t.kind!=='trend'||targets.length!==1||!d||!d.title.trim()||!d.summary.trim()||!d.body.trim()||d.title.length>500||d.summary.length>3000||d.body.length>20000){result.failures.push({key,message:'제목·요약을 입력하고 본문 길이를 확인해 주세요.'});continue;}
   const prior=await db.from('publication_working_copies').select('payload').eq('entity_type','report').eq('entity_id',actual.id).maybeSingle();
   if(prior.error||!prior.data?.payload){result.failures.push({key,message:'수정본을 불러오지 못했습니다. 입력 내용을 보관하고 다시 시도해 주세요.'});continue;}
   params.p_payload={...prior.data.payload,title_ko:d.title.trim(),one_line_summary_ko:d.summary.trim(),detailed_summary_ko:d.body.trim(),jurisdictions:d.jurisdictions,topics:d.topics};
  }
  try {const response=await db.rpc(rpcNames[command.operation],params);if(!response.error&&(!response.data||response.data.entity_id!==actual.id))throw new Error("unconfirmed_result");const {error}=response;if(error){const message=error.code==='40001'?'선택 후 내용이 변경됐습니다. 새로고침하고 변경된 내용을 확인해 주세요.':error.code==='42501'?'이 작업을 수행할 권한이 없습니다.':error.code==='PGRST202'?'작업 공간 기능을 준비 중입니다. 입력 내용은 그대로 두고 잠시 후 다시 시도해 주세요.':/published|public/i.test(error.message??'')&&command.operation==='trash'?'먼저 관리자가 공개를 취소해야 휴지통으로 옮길 수 있습니다.':'처리하지 못했습니다. 자료의 현재 상태를 확인한 뒤 다시 시도해 주세요.';result.failures.push({key,message});}else result.succeeded.push(key);
  } catch {result.failures.push({key,message:'연결이 끊겼습니다. 새로고침하여 실제 상태를 확인해 주세요.'});}
 }
 if(result.succeeded.length){revalidatePath('/work','layout');revalidatePath('/public','layout');revalidatePath('/team');revalidatePath('/');}
 return result;
}
