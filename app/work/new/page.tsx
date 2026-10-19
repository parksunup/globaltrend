import Link from 'next/link';
import WorkFrame from '../frame';
import {workspaceSession} from '../../../lib/workspace-data';
import {loadAllTrendImportCandidates} from '../../../lib/workspace-submissions';
import NewTrendForm from './new-trend-form';
import styles from '../work.module.css';
export const dynamic='force-dynamic';
export default async function NewTrend({searchParams}:{searchParams:Promise<{candidate?:string}>}) {
 const {candidate: candidateId}=await searchParams;const {db,canEdit}=await workspaceSession();
 const readOnlyPreview=process.env.VERCEL_ENV==='preview';
 const {data}=canEdit?await db.from('sources').select('id,name').eq('is_active',true).order('name'):{data:[]};const sources=data??[];
 const candidates=loadAllTrendImportCandidates(),candidate=candidates.find(c=>c.id===candidateId);
 const sourceHint=candidate?.source==='curia'?'CJEU':candidate?.source.toUpperCase();
 const candidateSource=sourceHint?sources.find(s=>s.name.toUpperCase().includes(sourceHint)):null;
 return <WorkFrame><Link href="/work">← 자료 목록</Link><h1>새 동향 작성</h1><p><Link href="/work/new/law">법제 제출 자료 등록하기 →</Link></p>
 {!canEdit?<p><Link href="/work">팀 계정으로 로그인</Link>해 주세요.</p>:<>
 <details className={styles.card}><summary>제출한 동향에서 가져오기</summary><div className={styles.candidates}>{candidates.map(c=><Link key={c.id} href={'/work/new?candidate='+encodeURIComponent(c.id)}>{c.title}</Link>)}</div></details>
 <section className={styles.card}><p>저장한 자료는 목록에서 바로 공개할 수 있습니다. 저장만으로 공개되지는 않습니다.</p>
<NewTrendForm sources={sources} candidate={candidate} candidateSource={candidateSource} readOnlyPreview={readOnlyPreview}/>
</section></>}
 </WorkFrame>;
}
