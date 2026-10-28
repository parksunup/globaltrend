import { createLiveWorkspaceReader } from '../../../lib/live-team-workspace';
import { composeTeamTrends, loadTeamTrendRows, parseTrendEdit } from '../../../lib/team-trends';
import { createClient } from '../../../lib/supabase/server';
const readLiveWorkspace = createLiveWorkspaceReader({
  token:process.env.TEAM_GITHUB_READ_TOKEN,
  fetch:(url,init)=>fetch(url,{...init,cache:'force-cache',next:{revalidate:String(url).includes('/branches?')?120:86400}}),
});
// Next Data Cache is shared across instances. Browser traffic must not multiply
// unauthenticated GitHub requests for the same branch list or immutable files.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;
export async function GET(request: Request) {
  const role = new URL(request.url).searchParams.get('role');
  const headers = {'Cache-Control':'private, no-store','Vary':'Cookie, Authorization','X-Robots-Tag':'noindex, nofollow'};
  if (role !== 'legal' && role !== 'trends') return Response.json({error:'법제 또는 동향 담당을 선택해 주세요.'},{status:400,headers});
  try {
    let rows:Awaited<ReturnType<typeof loadTeamTrendRows>>=[], databaseAvailable=role!=='trends';
    let teamAuthenticated=false;
    if(role==='trends') {
      const db=await createClient();
      const token=/^Bearer ([a-f0-9]{64})$/.exec(request.headers.get('authorization')??'')?.[1]??null;
      if(!token) {
        const {data:{user}}=await db.auth.getUser();teamAuthenticated=Boolean(user);
        if(!user)return Response.json({error:'팀 계정으로 로그인하면 초안 전체를 볼 수 있습니다.',loginRequired:true},{status:401,headers});
      }
      try {
        rows=await loadTeamTrendRows({readPage:async offset=>{
          const {data,error}=await db.rpc('get_team_trend_workspace',{p_offset:offset,p_limit:200,p_token:token});
          if(error)throw Object.assign(new Error(error.message),{code:error.code});
          return data;
        }});databaseAvailable=true;
      }
      catch(error) {
        if(error instanceof Error&&'code' in error&&error.code==='42501')return Response.json({error:token?'연결키가 만료되거나 해제됐습니다. 작업실에서 연결 프롬프트를 다시 복사해 주세요.':token?'연결키가 만료되거나 해제됐습니다. 작업실에서 연결 프롬프트를 다시 복사해 주세요.':'이 계정이 팀에 등록되어 있는지 확인해 주세요. Supabase 관리자 권한은 필요하지 않습니다.',loginRequired:!teamAuthenticated},{status:403,headers});
        console.error('Team draft reader unavailable:',error instanceof Error?error.message:'unknown');
      }
    }
    const snapshot = await readLiveWorkspace(role);
    const trends = role==='trends'?composeTeamTrends(rows,snapshot,[]):null;
    const {publicationInputs:_privatePublicationInputs,...visibleSnapshot}=snapshot;
    const db=await createClient();const {data:{user}}=await db.auth.getUser();
    const {data:membership}=user&&typeof db.from==='function'?await db.from('team_memberships').select('role,is_active').eq('user_id',user.id).maybeSingle():{data:null};
    const canPublish=Boolean(membership?.is_active&&['admin','editor'].includes(String(membership.role)));
    const canManageWeekly=Boolean(membership?.is_active&&membership.role==='admin');
    let legalPublications:{recordId:string;title:string;jurisdiction:string;status:'published'|'draft'|'ready';publishedId?:string}[]=[];
    if(role==='legal'&&snapshot.publicationInputs) {
      const instruments=await db.from('legal_instruments').select('id,jurisdiction_code,short_name');
      const rows=instruments.data??[];const ids=rows.map(row=>row.id);
      const versions=ids.length?await db.from('law_versions').select('id,legal_instrument_id,status,content_hash').in('legal_instrument_id',ids):{data:[],error:null};
      if(!instruments.error&&!versions.error)legalPublications=snapshot.publicationInputs.legal.map(candidate=>{
        const instrument=rows.find(row=>row.jurisdiction_code===candidate.jurisdiction&&row.short_name===candidate.instrument.title);
        const related=(versions.data??[]).filter(row=>row.legal_instrument_id===instrument?.id);
        const published=related.find(row=>row.status==='published');
        const matching=related.find(row=>row.content_hash===candidate.contentHash);
        return {recordId:candidate.recordId,title:candidate.instrument.title,jurisdiction:candidate.jurisdiction,
          status:published&&matching?.id===published.id?'published':matching?'draft':'ready',...(published?{publishedId:published.id}:{})};
      });
    }
    const data = {...visibleSnapshot,databaseAvailable,trends:trends?.items??[],canPublish,canManageWeekly,legalPublications,warnings:[...(trends?.warnings??[]),...(!databaseAvailable?['DB 초안 연결을 확인하지 못했습니다. 현재는 GitHub 자료만 표시하며 전체 원고가 아닙니다. 관리자에게 작업실 읽기 연결 상태를 확인해 달라고 알려 주세요.']:[])]};
    const publicationRevision=role==='legal'?legalPublications.map(item=>`${item.recordId}:${item.status}:${item.publishedId??''}`).join('|'):'legal';
    const etag = '"' + role + '-' + data.commitSha + '-' + (trends?.revision??publicationRevision) + '"';
    if (!data.stale && databaseAvailable && request.headers.get('if-none-match') === etag) return new Response(null,{status:304,headers:{...headers,ETag:etag}});
    return Response.json(data,{headers:{...headers,ETag:etag}});
  } catch (error) {
    console.error('Team workspace read failed:',error instanceof Error?error.message:'unknown');
    return Response.json({error:'최신 제출 자료를 읽지 못했습니다. GitHub 연결·요청 한도·담당 브랜치 상태를 확인해 주세요. 발행 권한 때문에 숨긴 것이 아닙니다.'},{status:503,headers});
  }
}

export async function PUT(request:Request) {
  const headers={'Cache-Control':'private, no-store','Vary':'Cookie, Authorization'};
  const token=/^Bearer ([a-f0-9]{64})$/.exec(request.headers.get('authorization')??'')?.[1]??null;
  if(!token&&request.headers.get('origin')!==new URL(request.url).origin)return Response.json({error:'작업실 로그인 또는 Codex 연결키가 필요합니다.'},{status:403,headers});
  let edits:{edit:ReturnType<typeof parseTrendEdit>;expected_revision:number}[];
  try {
    const text=await request.text();if(text.length>2_000_000)throw Error('한 번에 저장할 원고가 너무 많습니다. 나누어 저장해 주세요.');
    const body=JSON.parse(text);if(!Array.isArray(body.edits)||body.edits.length<1||body.edits.length>100)throw Error('수정본 1~100개를 지정해 주세요.');
    edits=body.edits.map((entry:{edit:unknown;expected_revision:number})=>{
      if(!Number.isSafeInteger(entry.expected_revision)||entry.expected_revision<0)throw Error('작업실 수정 판본이 필요합니다.');
      return {edit:parseTrendEdit(entry.edit),expected_revision:entry.expected_revision};
    });
  }catch(error){return Response.json({error:error instanceof Error?error.message:'잘못된 수정본입니다.'},{status:400,headers});}
  const db=await createClient();
  const {data,error}=await db.rpc('save_team_trend_edits',{p_edits:edits,p_token:token});
  if(error)return Response.json({error:error.code==='40001'?'원고가 변경됐습니다. 최신 작업실 자료와 대조한 뒤 다시 저장해 주세요.':error.code==='42501'?'로그인 또는 연결키를 확인해 주세요.':'수정본을 저장하지 못했습니다. 원고 형식과 연결 상태를 확인해 주세요.',code:error.code},{status:error.code==='40001'?409:error.code==='42501'?403:400,headers});
  return Response.json(data,{headers});
}
