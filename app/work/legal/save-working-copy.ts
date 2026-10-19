"use server";
import {revalidatePath} from 'next/cache';
import {workspaceSession} from '../../../lib/workspace-data';
import {applyLegalTextChanges} from '../../../lib/legal-working-copy';
import type {LegalReviewPackage} from '../../../lib/legal-release';
export async function saveLegalWorkingCopy(previous:{ok:boolean;message:string;revision:string},form:FormData) {
 const revision=String(form.get('revision')??''),id=String(form.get('id')??'');
 const fail=(message:string)=>({ok:false,message,revision});
 if(process.env.VERCEL_ENV==='preview')return fail('화면 확인용입니다. 실제 저장은 운영 작업 공간을 이용해 주세요.');
 if(!/^[a-f0-9-]{36}$/i.test(id)||!/^\d+$/.test(revision)||!Number.isSafeInteger(Number(revision)))return fail('자료 상태를 새로고침해 주세요.');
 const {db,canEdit}=await workspaceSession();if(!canEdit)return fail('수정할 팀 권한이 없습니다.');
 const {data,error}=await db.from('publication_working_copies').select('payload,revision').eq('entity_type','law').eq('entity_id',id).maybeSingle();
 if(error||!data)return fail('작업본을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.');
 if(String(data.revision)!==revision)return fail('다른 사람이 내용을 수정했습니다. 입력 내용을 복사한 뒤 새로고침해 주세요.');
 let payload:LegalReviewPackage;try{const raw=String(form.get('changes')??'{}');if(raw.length>3000000)throw new Error('too_large');payload=applyLegalTextChanges(data.payload as LegalReviewPackage,JSON.parse(raw));}catch{return fail('내용이 비어 있거나 허용되지 않는 수정입니다. 입력 내용을 확인해 주세요.');}
 const result=await db.rpc('save_publication_draft',{p_entity_type:'law',p_entity_id:id,p_expected_revision:Number(revision),p_payload:payload});
 if(result.error)return fail(result.error.code==='40001'?'저장하는 동안 내용이 변경됐습니다. 입력 내용을 복사하고 새로고침해 주세요.':'수정본을 저장하지 못했습니다. 입력 내용은 유지됩니다.');
 revalidatePath('/work','layout');return {ok:true,message:'수정본을 저장했습니다. 현재 공개본은 그대로이며, 자료 목록에서 수정본을 공개할 수 있습니다.',revision:String(result.data.revision)};
}
