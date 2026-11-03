import {revalidatePath} from 'next/cache';
import {createClient} from '../../../../lib/supabase/server';
import {createLiveWorkspaceReader} from '../../../../lib/live-team-workspace';
import {loadTeamTrendRows} from '../../../../lib/team-trends';
import {trendEditMatchesRow} from '../../../../lib/team-trend-publication';
import {prepareLegalCandidate,prepareTrendCandidate} from '../../../../lib/workspace-submissions';

export const runtime='nodejs';
export const dynamic='force-dynamic';
export const maxDuration=60;
const headers={'Cache-Control':'private, no-store','Vary':'Cookie','X-Robots-Tag':'noindex, nofollow'};
const readLiveWorkspace=createLiveWorkspaceReader({token:process.env.TEAM_GITHUB_READ_TOKEN,fetch:(url,init)=>fetch(url,{...init,cache:'force-cache',next:{revalidate:String(url).includes('/branches?')?120:86400}})});
const uuid=(value:string)=>/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(value);
async function authorized(request:Request) {
 if(process.env.VERCEL_ENV==='preview'||process.env.NODE_ENV!=='production')throw Object.assign(new Error('미리보기와 로컬 화면에서는 실제 공개 상태를 바꾸지 않습니다. 운영 작업실에서 실행해 주세요.'),{status:409});
 if(request.headers.get('origin')!==new URL(request.url).origin)throw Object.assign(new Error('작업실 화면에서 다시 시도해 주세요.'),{status:403});
 const db=await createClient(),{data:{user}}=await db.auth.getUser();
 if(!user)throw Object.assign(new Error('담당자 계정으로 로그인해 주세요.'),{status:401});
 const {data:member,error}=await db.from('team_memberships').select('role,is_active').eq('user_id',user.id).maybeSingle();
 if(error||!member?.is_active||!['admin','editor'].includes(String(member.role)))throw Object.assign(new Error('공개 설정 권한이 있는 편집 담당자 계정이 필요합니다.'),{status:403});
 return db;
}
function fail(error:unknown) {
 const status=error&&typeof error==='object'&&'status'in error?Number((error as {status:unknown}).status):400;
 return Response.json({error:error instanceof Error?error.message:'요청을 처리하지 못했습니다.'},{status,headers});
}
export async function POST(request:Request) {
 let body:{role?:unknown;action?:unknown;branchSha?:unknown;itemId?:unknown;officialUrl?:unknown};
 try {body=await request.json();}catch{return Response.json({error:'요청 내용을 읽지 못했습니다.'},{status:400,headers});}
 if(!['legal','trends'].includes(String(body.role))||!['publish','unpublish','trash'].includes(String(body.action))||typeof body.branchSha!=='string'||!/^[a-f0-9]{40}$/.test(body.branchSha)||typeof body.itemId!=='string')return Response.json({error:'담당·자료·판본을 다시 확인해 주세요.'},{status:400,headers});
 try {
  const db=await authorized(request),role=body.role as 'legal'|'trends',action=body.action as 'publish'|'unpublish'|'trash';
  if(action==='trash'&&role!=='trends')throw Object.assign(new Error('동향 원고만 휴지통으로 이동할 수 있습니다.'),{status:400});
  const snapshot=await readLiveWorkspace(role);
  if(snapshot.stale||snapshot.commitSha!==body.branchSha)throw Object.assign(new Error('담당 브랜치가 바뀌었습니다. 화면을 새로고침해 최신 자료를 확인한 뒤 다시 실행해 주세요.'),{status:409});
  const inputs=snapshot.publicationInputs;
  if(!inputs)throw Object.assign(new Error('공개 자료를 준비하지 못했습니다. 최신 자료를 다시 불러와 주세요.'),{status:503});
  let entityId='',revision='',rpcAction=action==='publish'?'publish_publication_draft':'unpublish_publication';
  if(role==='trends') {
   if(uuid(body.itemId)) {
    const rows=await loadTeamTrendRows({readPage:async offset=>{const {data,error}=await db.rpc('get_team_trend_workspace',{p_offset:offset,p_limit:200});if(error)throw error;return data;}});
    const row=rows.find(item=>item.id===body.itemId);if(!row)throw Object.assign(new Error('동향 원고가 작업실 목록에 없습니다. 최신 화면을 다시 불러와 주세요.'),{status:404});
    if(action==='trash') {
     if(row.status==='published')throw Object.assign(new Error('먼저 공개를 취소한 뒤 휴지통으로 이동해 주세요.'),{status:409});
     const copy=await db.from('publication_working_copies').select('revision,trashed_at').eq('entity_type','report').eq('entity_id',row.id).maybeSingle();
     if(copy.error||!copy.data||copy.data.trashed_at)throw Object.assign(new Error('게시 작업본을 찾을 수 없거나 이미 휴지통에 있습니다.'),{status:409});
     entityId=row.id;revision=String(copy.data.revision);rpcAction='trash_publication_draft';
    } else if(action==='publish'&&row.workspaceEdit&&!trendEditMatchesRow(row.workspaceEdit,row)) {
     if(row.workspaceEdit.base_revision!==row.revision)throw Object.assign(new Error('기준 원고가 달라 Codex 수정본을 공개하지 않았습니다. 최신 원고와 다시 대조해 주세요.'),{status:409});
     const copy=await db.from('publication_working_copies').select('revision,payload,trashed_at').eq('entity_type','report').eq('entity_id',row.id).maybeSingle();
     if(copy.error||!copy.data?.payload||copy.data.trashed_at)throw Object.assign(new Error('게시 작업본을 확인할 수 없습니다. 작업실 자료를 새로고침해 주세요.'),{status:409});
     const payload={...(copy.data.payload as Record<string,unknown>),title_ko:row.workspaceEdit.title_ko,one_line_summary_ko:row.workspaceEdit.summary_ko,detailed_summary_ko:row.workspaceEdit.details_ko};
     const saved=await db.rpc('save_publication_draft',{p_entity_type:'report',p_entity_id:row.id,p_expected_revision:Number(copy.data.revision),p_payload:payload});
     if(saved.error)throw Object.assign(new Error(saved.error.code==='40001'?'게시 작업본이 바뀌었습니다. 새로고침 후 다시 시도해 주세요.':'동향 수정본을 게시 작업본에 연결하지 못했습니다.'),{status:saved.error.code==='40001'?409:400});
     revision=String(saved.data?.revision??'');entityId=row.id;
    } else {entityId=row.id;const copy=await db.from('publication_working_copies').select('revision,trashed_at').eq('entity_type','report').eq('entity_id',row.id).maybeSingle();if(copy.error||!copy.data||copy.data.trashed_at)throw Object.assign(new Error('게시 작업본을 찾지 못했습니다.'),{status:409});revision=String(copy.data.revision);}
   } else {
    if(action!=='publish'||typeof body.officialUrl!=='string')throw Object.assign(new Error('아직 등록되지 않은 동향 자료는 공개 취소 대상이 아닙니다.'),{status:409});
    const candidate=inputs.trends.find(value=>value.officialUrl===body.officialUrl);
    if(!candidate)throw Object.assign(new Error('최신 담당 브랜치에 해당 동향 자료가 없습니다. 자료를 다시 확인해 주세요.'),{status:409});
    const prepared=await prepareTrendCandidate(db,candidate);entityId=prepared.id;revision=prepared.revision;
   }
  } else {
   const candidate=inputs.legal.find(value=>value.recordId===body.itemId);
   if(!candidate)throw Object.assign(new Error('최신 담당 브랜치에 해당 법제 자료가 없습니다. 자료를 다시 확인해 주세요.'),{status:409});
   const instrument=await db.from('legal_instruments').select('id').eq('jurisdiction_code',candidate.jurisdiction).eq('short_name',candidate.instrument.title).maybeSingle();
   if(instrument.error)throw instrument.error;
   if(action==='publish') {const prepared=await prepareLegalCandidate(db,candidate);entityId=prepared.id;revision=prepared.revision;}
   else {
    if(!instrument.data)throw Object.assign(new Error('이 법률은 아직 공개된 판본이 없습니다.'),{status:409});
    const published=await db.from('law_versions').select('id').eq('legal_instrument_id',instrument.data.id).eq('status','published').maybeSingle();
    if(published.error)throw published.error;if(!published.data)throw Object.assign(new Error('현재 공개 중인 판본이 없습니다.'),{status:409});
    const copy=await db.from('publication_working_copies').select('revision,trashed_at').eq('entity_type','law').eq('entity_id',published.data.id).maybeSingle();
    if(copy.error||!copy.data||copy.data.trashed_at)throw Object.assign(new Error('법제 게시 작업본을 찾지 못했습니다.'),{status:409});entityId=published.data.id;revision=String(copy.data.revision);
   }
  }
  if(!revision||!uuid(entityId)||!Number.isSafeInteger(Number(revision)))throw Object.assign(new Error('공개 작업본 판본을 확인하지 못했습니다.'),{status:409});
  const result=await db.rpc(rpcAction,{p_entity_type:role==='trends'?'report':'law',p_entity_id:entityId,p_expected_revision:Number(revision)});
  if(result.error)throw Object.assign(new Error(result.error.code==='40001'?'게시 자료가 바뀌었습니다. 최신 내용을 확인하고 다시 시도해 주세요.':result.error.code==='42501'?'로그인한 계정의 공개 권한이 확인되지 않았습니다. 관리자에게 편집 담당자 권한을 확인해 달라고 해 주세요.':'공개 상태를 바꾸지 못했습니다. 자료 상태와 공식 출처를 확인해 주세요.'),{status:result.error.code==='40001'?409:result.error.code==='42501'?403:400});
  revalidatePath('/public','layout');revalidatePath('/team');revalidatePath('/work');revalidatePath('/');
  return Response.json({ok:true,status:result.data?.status,entityId},{headers});
 } catch(error) {return fail(error);}
}
