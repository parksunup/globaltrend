import Link from 'next/link';
import {notFound} from 'next/navigation';
import {workspaceSession} from '../../../../../lib/workspace-data';
import type {LegalReviewPackage} from '../../../../../lib/legal-release';
import WorkFrame from '../../../frame';
import LegalEditor from '../../editor';
export const dynamic='force-dynamic';
export default async function EditLaw({params}:{params:Promise<{id:string}>}) {
 const {id}=await params;if(!/^[a-f0-9-]{36}$/i.test(id))notFound();const {db,canEdit}=await workspaceSession();
 if(!canEdit)return <WorkFrame><p><Link href="/work">팀 계정으로 로그인</Link>해 주세요.</p></WorkFrame>;
 const [{data:w,error},{data:v}]=await Promise.all([db.from('publication_working_copies').select('payload,revision,trashed_at').eq('entity_type','law').eq('entity_id',id).maybeSingle(),db.from('law_versions').select('status').eq('id',id).maybeSingle()]);
 if(error||!w?.payload||!v)notFound();const p=w.payload as LegalReviewPackage;
 return <WorkFrame><Link href="/work?kind=law">← 자료 목록</Link><h1>{p.instrument.title} 수정</h1>{w.trashed_at?<p>휴지통에서 복원한 뒤 수정할 수 있습니다.</p>:<LegalEditor id={id} revision={String(w.revision)} payload={p} readOnly={process.env.VERCEL_ENV==='preview'} published={v.status==='published'}/>}</WorkFrame>;
}
