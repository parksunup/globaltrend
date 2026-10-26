import { createClient } from '../../../../lib/supabase/server';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function POST(request:Request) {
  const headers={'Cache-Control':'private, no-store','Vary':'Cookie'};
  if(request.headers.get('origin')!==new URL(request.url).origin)return Response.json({error:'작업실 화면에서 연결해 주세요.'},{status:403,headers});
  const db=await createClient();
  const {data:{user}}=await db.auth.getUser();
  if(!user)return Response.json({error:'먼저 팀 계정으로 로그인해 주세요.'},{status:401,headers});
  const body=await request.json().catch(()=>null);
  if(!body||typeof body.revoke!=='boolean')return Response.json({error:'잘못된 요청입니다.'},{status:400,headers});
  const {data,error}=await db.rpc('issue_team_workspace_token',{p_revoke:body.revoke});
  if(error)return Response.json({error:error.code==='42501'?'이 계정의 팀 등록 상태를 확인해 주세요.':'Codex 연결 기능을 준비하지 못했습니다. 작업실 운영자에게 알려 주세요.'},{status:403,headers});
  return Response.json(data,{headers});
}
