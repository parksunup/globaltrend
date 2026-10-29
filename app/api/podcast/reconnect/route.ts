import {podcastAdmin,podcastError} from '../../../../lib/podcast-server';
import {PODCAST_DEDICATED_ACCOUNT,reconnectStorage,PODCAST_RECONNECT_MAX_BYTES} from '../../../../lib/podcast-reconnect';
export const runtime='nodejs';
export const dynamic='force-dynamic';
const headers={'Cache-Control':'private, no-store'};
export async function GET(){try{const db=await podcastAdmin();const {data,error}=await db.rpc('podcast_reconnect_status');if(error)throw Error('다시 연결 기능을 준비 중입니다.');return Response.json({...data,email:PODCAST_DEDICATED_ACCOUNT},{headers});}catch(e){return podcastError(e);}}
export async function POST(req:Request){try{
 const db=await podcastAdmin(req);
 if(Number(req.headers.get('content-length')??0)>PODCAST_RECONNECT_MAX_BYTES)throw Error('로그인 정보 크기를 확인해 주세요.');
 const raw=await req.text();if(Buffer.byteLength(raw)>PODCAST_RECONNECT_MAX_BYTES)throw Error('로그인 정보 크기를 확인해 주세요.');
 let input;try{input=JSON.parse(raw);}catch{throw Error('로그인 정보를 확인할 수 없습니다.');}
 const {data,error}=await db.rpc('queue_podcast_reconnect',{p_storage:reconnectStorage(input)});
 if(error)throw Error('연결 요청을 저장하지 못했습니다. 제작 중이면 잠시 후 다시 시도해 주세요.');
 return Response.json(data,{headers});
 }catch(e){return podcastError(e);}}
