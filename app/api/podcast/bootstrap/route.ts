import {podcastAdmin,podcastError} from '../../../../lib/podcast-server';

export const runtime='nodejs';
export const dynamic='force-dynamic';
const headers={'Cache-Control':'private, no-store'};

export async function GET(){
 try{
  const db=await podcastAdmin();
  const {data,error}=await db.rpc('podcast_master_bootstrap_status');
  if(error)throw Error('장기 로그인 상태를 확인하지 못했습니다.');
  return Response.json(data,{headers});
 }catch(error){return podcastError(error);}
}

export async function POST(request:Request){
 try{
  const db=await podcastAdmin(request);
  if(Number(request.headers.get('content-length')??0)>8192)throw Error('로그인 정보 크기를 확인해 주세요.');
  const raw=await request.text();
  if(Buffer.byteLength(raw)>8192)throw Error('로그인 정보 크기를 확인해 주세요.');
  let payload:unknown;
  try{payload=JSON.parse(raw);}catch{throw Error('로그인 정보를 확인하지 못했습니다.');}
  const token=payload&&typeof payload==='object'&&(payload as {oauthToken?:unknown}).oauthToken;
  if(typeof token!=='string'||token.length<20||token.length>4096||/\s|[\x00-\x1f\x7f]/.test(token))throw Error('Google 로그인을 끝낸 뒤 다시 시도해 주세요.');
  const {data,error}=await db.rpc('queue_podcast_master_bootstrap',{p_token:token});
  if(error)throw Error('장기 로그인 발급 요청을 저장하지 못했습니다. 잠시 후 다시 시도해 주세요.');
  return Response.json(data,{headers});
 }catch(error){return podcastError(error);}
}
