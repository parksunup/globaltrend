import {createRemoteJWKSet, jwtVerify} from 'https://deno.land/x/jose@v5.9.6/index.ts';
import {createClient} from 'https://esm.sh/@supabase/supabase-js@2.57.4';
import {audience,trusted} from './trust.ts';
const jwks=createRemoteJWKSet(new URL('https://token.actions.githubusercontent.com/.well-known/jwks'));
const db=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false}});
const uuid=(value:unknown)=>typeof value==='string'&&/^[a-f0-9-]{36}$/.test(value);
Deno.serve(async req=>{
  if(req.method!=='POST')return new Response('Method not allowed',{status:405});
  let claims;
  try {
    const token=req.headers.get('authorization')?.match(/^Bearer (.+)$/)?.[1];
    if(!token)throw Error();
    ({payload:claims}=await jwtVerify(token,jwks,{issuer:'https://token.actions.githubusercontent.com',audience,algorithms:['RS256'],maxTokenAge:'10m'}));
    if(!trusted(claims))throw Error();
  }catch{return new Response('Unauthorized',{status:401});}
  try {
    if(Number(req.headers.get('content-length')??0)>262144)throw Error('request too large');
    const raw=await req.text();if(raw.length>262144)throw Error('request too large');
    const body=JSON.parse(raw),run=`${claims.run_id}:${claims.run_attempt}`;
    async function step(action:string,data:Record<string,unknown>={}){
      const {data:result,error}=await db.rpc('podcast_cloud_step',{p_run:run,p_action:action,p_job_id:body.jobId??null,p_data:data});
      if(error)throw Error('worker_state_conflict');return result;
    }
    const action=body.action;
    if(['session_acquire','session_save','session_fail'].includes(action)){
      const {data:result,error}=await db.rpc('podcast_session_step',{
        p_run:run,p_action:action.slice(8),p_data:body.data??{}
      });
      if(error)throw Error('session_state_conflict');
      return Response.json(action==='session_acquire'?{session:result}:result,{
        headers:{'Cache-Control':'no-store'}
      });
    }
    if(action==='health')return Response.json(await step('health',{ok:body.ok===true}));
    if(action==='claim')return Response.json({job:await step('claim')});
    if(!uuid(body.jobId))throw Error('invalid job');
    if(['checkpoint','release'].includes(action))return Response.json({job:await step(action,body.data??{})});
    if(!['upload','complete'].includes(action))throw Error('invalid action');
    const job=await step('inspect');
    if(!['collecting','uploading'].includes(job.phase))throw Error('audio not expected');
    if(!['audio/mpeg','audio/wav','audio/mp4','audio/x-m4a'].includes(body.mime)||!Number.isSafeInteger(body.size)||body.size<1||body.size>52428800)throw Error('invalid audio');
    const ext=body.mime==='audio/mpeg'?'mp3':body.mime==='audio/wav'?'wav':'m4a';
    const path=`${job.issue_key}/${job.id}.${ext}`;
    const {data:files,error}=await db.storage.from('weekly-podcasts').list(job.issue_key,{search:job.id,limit:20});
    if(error)throw Error('storage unavailable');
    const file=files?.find(f=>f.name===`${job.id}.${ext}`);
    if(action==='upload'){
      if(file)return Response.json({path,alreadyUploaded:true});
      const {data:allowed,error:budgetError}=await db.rpc('podcast_cloud_storage_allowed',{p_size:body.size});
      if(budgetError||!allowed)throw Error('storage_free_budget');
      const {data:target,error:signError}=await db.storage.from('weekly-podcasts').createSignedUploadUrl(path);
      if(signError||!target)throw Error('upload unavailable');
      return Response.json({path,url:target.signedUrl});
    }
    if(!file||Number(file.metadata?.size)!==body.size||file.metadata?.mimetype!==body.mime)throw Error('audio metadata mismatch');
    return Response.json(await step('complete',{path,mime:body.mime,size:body.size}));
  }catch{return Response.json({error:'작업 상태·로그인·저장 한도를 확인해 주세요. 비밀정보는 기록하지 않았습니다.'},{status:409});}
});
