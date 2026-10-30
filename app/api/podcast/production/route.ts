import {revalidatePath} from 'next/cache';
import {makePodcastPacket, PODCAST_MAX_AUDIO_BYTES, uuid} from '../../../../lib/podcast-production';
import {monthlyWeekIssueKey} from '../../../../lib/weekly-label';
import {readAllPages} from '../../../../lib/read-all-pages';
import {podcastAdmin, podcastError, podcastStories, storyHash} from '../../../../lib/podcast-server';
import {podcastPublishingAllowed} from '../../../../lib/podcast-publishing-access';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const headers = {'Cache-Control':'private, no-store'};
const recentCloudCheck = (value:unknown) => typeof value === 'string' && Number.isFinite(Date.parse(value)) && Date.now()-Date.parse(value) < 7200000;
function canPublishFrom(request:Request){
  return podcastPublishingAllowed({nodeEnv:process.env.NODE_ENV,vercelEnv:process.env.VERCEL_ENV,
    branch:process.env.VERCEL_GIT_COMMIT_REF,hostname:new URL(request.url).hostname});
}
export async function GET(request: Request) {
  try {
    const db = await podcastAdmin();
    const [stories, jobs, cloud, episodeRows] = await Promise.all([new URL(request.url).searchParams.has('jobsOnly') ? Promise.resolve(undefined) : podcastStories(db), db.from('podcast_production_jobs').select('*').order('created_at',{ascending:false}).limit(30), db.from('podcast_cloud_runtime').select('enabled,status,last_seen_at').eq('id',true).maybeSingle(),readAllPages(async(offset,count)=>{const {data,error}=await db.from('weekly_podcast_episodes').select('issue_key,status,published_at').order('published_at',{ascending:false}).range(offset,offset+count-1);if(error)throw error;return data??[];})]);
    const issueBatches=await Promise.all(Array.from({length:Math.ceil(episodeRows.length/100)},(_,index)=>db.from('weekly_issues').select('issue_key,title,week_start,week_end').in('issue_key',episodeRows.slice(index*100,(index+1)*100).map(episode=>episode.issue_key))));
    const issueError=issueBatches.find(result=>result.error)?.error;
    if(issueError)throw issueError;
    const episodeIssues=issueBatches.flatMap(result=>result.data??[]);
    const episodes=episodeRows.flatMap(episode=>{const issue=episodeIssues.find(row=>row.issue_key===episode.issue_key);return issue?[{...episode,...issue}]:[];});
    const cloudReady = !!cloud.data?.enabled && cloud.data.status === 'ready' && recentCloudCheck(cloud.data.last_seen_at);
    return Response.json({stories, jobs:jobs.data ?? [],episodes, cloudReady, cloudStatus:cloud.data?.status??'setup_required', setupRequired:!!jobs.error, canPublish:canPublishFrom(request)}, {headers});
  } catch (error) {return podcastError(error);}
}
export async function POST(request: Request) {
  try {
    const db = await podcastAdmin(request);
    const body = await request.json();
    if (body.action === 'prepare') {
      const mode = body.executionMode === 'cloud' ? 'cloud' : 'browser';
      if (mode === 'cloud') {
        const {data:cloud} = await db.from('podcast_cloud_runtime').select('enabled,status,last_seen_at').eq('id',true).maybeSingle();
        if (!cloud?.enabled || cloud.status !== 'ready' || !recentCloudCheck(cloud.last_seen_at)) throw Error('클라우드 연결이 아직 준비되지 않았습니다. 전용 Google 계정 연결과 클라우드 실행 상태를 확인해 주세요.');
      }
      const {mainId, briefId, contextIds = [], weekStart, weekEnd} = body;
      if (!uuid(mainId) || (briefId && !uuid(briefId)) || !Array.isArray(contextIds) || contextIds.length > 8 || !contextIds.every(uuid)) throw Error('메인 주제와 추가 소식을 확인해 주세요.');
      const stories = await podcastStories(db, [mainId, ...contextIds, ...(briefId ? [briefId] : [])]);
      const startDate=typeof weekStart==='string'?new Date(`${weekStart}T00:00:00Z`):null;
      if(typeof weekStart!=='string'||typeof weekEnd!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(weekStart)||!startDate||Number.isNaN(startDate.valueOf())||startDate.toISOString().slice(0,10)!==weekStart||startDate.getUTCDay()!==1||weekEnd!==new Date(startDate.valueOf()+6*86400000).toISOString().slice(0,10))throw Error('주간호 시작일과 종료일을 확인해 주세요.');
      const previewPacket=makePodcastPacket({issueKey:monthlyWeekIssueKey(weekStart), weekStart, weekEnd, main:stories[0], context:stories.slice(1,1+contextIds.length), brief:briefId ? stories.at(-1) : undefined});
      const {data:reservedKey,error:reserveError}=await db.rpc('reserve_weekly_podcast_issue_key',{p_week_start:weekStart});
      if(reserveError||typeof reservedKey!=='string')throw Error('새 팟캐스트 회차를 준비하지 못했습니다. DB 변경 적용 여부를 확인해 주세요.');
      const packet={...previewPacket,issueKey:reservedKey};
      const sourceHash = storyHash(stories);
      const {data:existing, error:lookupError} = await db.from('podcast_production_jobs').select('*').eq('issue_key',reservedKey).maybeSingle();
      if (lookupError) throw Error('제작 기록을 준비하지 못했습니다. 팟캐스트 DB 변경 적용 여부를 확인해 주세요.');
      if (existing) {
        if (existing.execution_mode !== mode) throw Error('이 회차는 다른 방식으로 제작 중입니다. 기존 제작 기록을 확인해 주세요.');
        if (existing.source_hash !== sourceHash || Object.keys(packet).some(key => JSON.stringify(existing.packet[key]) !== JSON.stringify(packet[key as keyof typeof packet]))) throw Error('이 주간호에는 다른 제작 자료가 있습니다. 기존 제작 기록을 확인해 주세요.');
        return Response.json({job:existing}, {headers});
      }
      const {data,error} = await db.from('podcast_production_jobs').insert({execution_mode:mode,issue_key:reservedKey,packet,source_hash:sourceHash,report_snapshot:stories,auto_publish:body.autoPublish === true && canPublishFrom(request)}).select().single();
      if (error) throw Error(error.code === '23505' ? '같은 주간호가 방금 만들어졌습니다. 목록을 새로 확인해 주세요.' : '제작 자료를 저장하지 못했습니다.');
      return Response.json({job:data}, {headers});
    }
    if(body.action==='unpublishIssue'){
      if(typeof body.issueKey!=='string'||!/^\d{4}-\d{2}-W[1-5]-[1-9]\d*$/.test(body.issueKey))throw Error('공개 취소할 팟캐스트 회차를 확인해 주세요.');
      const {error}=await db.rpc('unpublish_weekly_podcast_issue',{p_issue_key:body.issueKey});
      if(error)throw Error('팟캐스트 공개를 취소하지 못했습니다. 상태를 새로고침해 주세요.');
      revalidatePath('/public','layout');
      return Response.json({ok:true},{headers});
    }
    if (!uuid(body.jobId)) throw Error('제작 기록을 확인해 주세요.');
    const {data:job,error:jobError} = await db.from('podcast_production_jobs').select('*').eq('id',body.jobId).single();
    if (jobError || !job) throw Error('제작 기록을 찾지 못했습니다.');
    if (body.action === 'status') return Response.json({job}, {headers});
    if (body.action === 'unpublish') {
      const {error}=await db.rpc('unpublish_podcast_production_job',{p_job_id:job.id});
      if(error)throw Error('팟캐스트 공개를 취소하지 못했습니다. 상태를 새로고침해 주세요.');
      revalidatePath('/public','layout');
      return Response.json({job:{...job,phase:'unpublished'}},{headers});
    }
    if (body.action === 'listen') {
      if (!job.audio_path) throw Error('아직 완성된 오디오가 없습니다.');
      const {data,error} = await db.storage.from('weekly-podcasts').createSignedUrl(job.audio_path,300);
      if (error || !data) throw Error('오디오를 열지 못했습니다.');
      return Response.json({url:data.signedUrl}, {headers});
    }
    if (['published','unpublished'].includes(job.phase)) return Response.json({job}, {headers});
    if (body.action === 'resumeCloud') {
      if (job.execution_mode !== 'cloud' || !['failed','needs_login'].includes(job.phase)) throw Error('진행 중인 제작은 기다려 주세요. 완료 여부가 불명확한 요청은 NotebookLM에서 먼저 확인해야 합니다.');
      if (['creating_notebook','adding_source','requesting_audio'].includes(job.cloud_checkpoint?.stage)) throw Error('외부 요청의 완료 여부를 먼저 확인해 주세요. 중복 생성을 막기 위해 자동 재시도하지 않습니다.');
      const {error} = await db.from('podcast_production_jobs').update({phase:'queued',message:'',cloud_run:null,cloud_lease_until:null,updated_at:new Date().toISOString()}).eq('id',job.id).eq('phase',job.phase);
      if (error) throw Error('클라우드 재개 요청을 저장하지 못했습니다.');
      return Response.json({ok:true},{headers});
    }
    if (job.execution_mode === 'cloud' && (['upload','complete'].includes(body.action) || (body.action === 'progress' && body.phase !== 'cancelled'))) throw Error('이 회차는 클라우드에서 처리 중입니다. 제작 현황을 확인해 주세요.');
    if (body.action === 'progress') {
      if (['ready','cancelled'].includes(job.phase)) return Response.json({job}, {headers});
      if (!['opening','adding_sources','generating','collecting','uploading','needs_login','blocked','failed','cancelled'].includes(body.phase)) throw Error('제작 단계를 확인해 주세요.');
      let notebookUrl = job.notebook_url;
      if (body.notebookUrl) {
        const url = new URL(body.notebookUrl);
        if (url.protocol !== 'https:' || !['notebook.google.com','notebooklm.google.com'].includes(url.hostname) || !/^\/notebook\/[a-f0-9-]{36}$/.test(url.pathname)) throw Error('NotebookLM 주소가 올바르지 않습니다.');
        notebookUrl = url.origin + url.pathname;
      }
      const {data,error} = await db.from('podcast_production_jobs').update({phase:body.phase,notebook_url:notebookUrl,message:String(body.message ?? '').slice(0,500),updated_at:new Date().toISOString()}).eq('id',job.id).eq('phase',job.phase).select().single();
      if (error) throw Error('제작 단계가 바뀌었습니다. 목록을 새로 확인해 주세요.');
      return Response.json({job:data}, {headers});
    }
    if (job.phase === 'cancelled') throw Error('중단한 제작입니다.');
    if (body.action === 'upload' || body.action === 'complete') {
      if (!['audio/mpeg','audio/wav','audio/mp4','audio/x-m4a'].includes(body.mime) || !Number.isInteger(body.size) || body.size < 1 || body.size > PODCAST_MAX_AUDIO_BYTES) throw Error('오디오 형식 또는 크기를 확인해 주세요. 최대 50MB입니다.');
      const ext = body.mime === 'audio/mpeg' ? 'mp3' : body.mime === 'audio/wav' ? 'wav' : 'm4a';
      const path = `${job.issue_key}/${job.id}.${ext}`;
      if (body.action === 'upload') {
        const {data:files,error:listError} = await db.storage.from('weekly-podcasts').list(job.issue_key,{search:job.id,limit:20});
        if (listError) throw Error('오디오 저장 공간을 확인하지 못했습니다.');
        if (files?.some(file=>file.name===`${job.id}.${ext}`)) return Response.json({path,alreadyUploaded:true}, {headers});
        const {data,error} = await db.storage.from('weekly-podcasts').createSignedUploadUrl(path);
        if (error || !data) throw Error('오디오 업로드를 준비하지 못했습니다.');
        return Response.json({path,token:data.token}, {headers});
      }
      const {data:files,error:audioError} = await db.storage.from('weekly-podcasts').list(job.issue_key,{search:job.id,limit:20});
      const audio = files?.find(file=>file.name===`${job.id}.${ext}`);
      if (audioError || !audio || Number(audio.metadata?.size) !== body.size || audio.metadata?.mimetype !== body.mime) throw Error('저장된 오디오가 일치하지 않습니다. 다시 연결해 주세요.');
      const {error} = await db.from('podcast_production_jobs').update({phase:'ready',audio_path:path,audio_mime_type:body.mime,file_size_bytes:body.size,message:'',updated_at:new Date().toISOString()}).eq('id',job.id).neq('phase','cancelled').neq('phase','published');
      if (error) throw Error('오디오 완료 상태를 저장하지 못했습니다.');
      if (!job.auto_publish) return Response.json({job:{...job,phase:'ready',audio_path:path}}, {headers});
    } else if (body.action !== 'publish') throw Error('지원하지 않는 작업입니다.');
    if (!canPublishFrom(request)) throw Object.assign(Error('이 주소에서는 게시할 수 없습니다. 승인된 작업실에서 실행해 주세요.'), {status:409});
    const current = await podcastStories(db, job.packet.reportIds);
    if (storyHash(current) !== job.source_hash) throw Error('제작 중 동향 내용이 바뀌었습니다. 오디오와 최신 내용을 대조한 뒤 다시 제작해 주세요.');
    const {error} = await db.rpc('publish_podcast_production_job',{p_job_id:job.id});
    if (error) throw Error('주간호 공개에 실패했습니다. 오디오는 보관되어 있으니 다시 공개해 주세요.');
    revalidatePath('/public','layout');
    return Response.json({job:{...job,phase:'published'}}, {headers});
  } catch (error) {return podcastError(error);}
}
