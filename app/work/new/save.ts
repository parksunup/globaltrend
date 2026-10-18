"use server";
import {revalidatePath} from 'next/cache';
import {workspaceSession} from '../../../lib/workspace-data';
export async function createWorkspaceNewDraft(form:FormData) {
 const fail=(message:string)=>({ok:false,message});
 if(process.env.VERCEL_ENV==='preview')return fail('화면 확인용입니다. 운영 작업 공간에서 저장해 주세요.');
 const {db,canEdit}=await workspaceSession();if(!canEdit)return fail('팀 계정으로 다시 로그인해 주세요. 입력 내용은 복사해 보관할 수 있습니다.');
 const read=(key:string)=>String(form.get(key)??'').trim();const split=(key:string)=>read(key).split(',').map(s=>s.trim()).filter(Boolean).slice(0,12);
 const source=read('source_id'),url=read('canonical_url'),original=read('original_title'),title=read('title_ko'),summary=read('summary_ko'),body=read('details_ko'),date=read('source_published_date');
 let valid=false;try{valid=new URL(url).protocol==='https:';}catch{}
 if(!/^[a-f0-9-]{36}$/i.test(source)||!valid||!original||!title||!summary||!body||original.length>500||title.length>500||summary.length>3000||body.length>20000||(date&&!/^\d{4}-\d{2}-\d{2}$/.test(date)))return fail('출처·원문 주소·제목·요약·본문을 확인해 주세요. 입력 내용은 유지됩니다.');
 try{const {error}=await db.rpc('create_report_draft',{p_source_id:source,p_canonical_url:url,p_original_title:original,p_title_ko:title,p_summary_ko:summary,p_details_ko:body,p_jurisdictions:split('jurisdictions'),p_topics:split('topics'),p_source_published_at:date?date+'T12:00:00Z':null});
 if(error)return fail(error.code==='23505'?'같은 원문 주소의 자료가 이미 있습니다. 입력 내용을 보관하고 목록의 기존 자료를 수정해 주세요.':'저장하지 못했습니다. 입력 내용은 유지됩니다. 잠시 후 다시 시도해 주세요.');
 revalidatePath('/work');return {ok:true,message:'저장했습니다.'};}catch{return fail('연결하지 못했습니다. 입력 내용은 유지됩니다.');}
}
