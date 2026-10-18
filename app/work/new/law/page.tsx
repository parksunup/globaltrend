import Link from 'next/link';
import WorkFrame from '../../frame';
import {workspaceSession} from '../../../../lib/workspace-data';
import {buildLegalReviewPackages} from '../../../../lib/legal-release';
import {importLegalReview} from '../../legal/actions';
import styles from '../../work.module.css';
export const dynamic='force-dynamic';
export default async function ImportLaws(){const {db,canEdit}=await workspaceSession();const {data}=canEdit?await db.from('law_versions').select('content_hash'):{data:[]};const hashes=new Set((data??[]).map(v=>v.content_hash));
 return <WorkFrame><Link href="/work">← 자료 목록</Link><h1>법제 제출 자료 등록</h1><p>저장소에 제출한 한국어 전문과 17개 비교표를 한 묶음으로 등록합니다. 등록 후 목록에서 선택해 공개할 수 있습니다.</p>{!canEdit?<p><Link href="/work">팀 계정으로 로그인</Link>해 주세요.</p>:buildLegalReviewPackages().map(p=><article className={styles.card} key={p.recordId}><h2>{p.instrument.title}</h2><p>{p.versionLabel} · 비교 기준 {p.cells.length}개 · {p.document?'한국어 전문 포함':'공식 원문 별도 열람'}</p><Link href={p.document?'/legal-translation/'+p.document.id:'/legal-drafts'}>제출 내용 보기 →</Link><form action={importLegalReview}><input type="hidden" name="record_id" value={p.recordId}/><input type="hidden" name="content_hash" value={p.contentHash}/><button disabled={hashes.has(p.contentHash)||process.env.VERCEL_ENV==='preview'}>{hashes.has(p.contentHash)?'이미 등록된 판본':'작업 공간에 등록'}</button></form></article>)}</WorkFrame>;
}
