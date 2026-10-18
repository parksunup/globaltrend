import Link from 'next/link';
import WorkFrame from './frame';
import Workspace from './workspace';
import {workspaceSession,loadWorkspaceItems,previewWorkspaceItems} from '../../lib/workspace-data';
import {executeWorkspaceAction} from './workspace-actions';
import {signIn,signOut} from './actions';
import styles from './work.module.css';
export const dynamic='force-dynamic';
export default async function WorkPage({searchParams}:{searchParams:Promise<{kind?:string;notice?:string}>}) {
 const {kind,notice}=await searchParams;const session=await workspaceSession();const readOnly=process.env.VERCEL_ENV==='preview';
 const result=session.canEdit?await loadWorkspaceItems(session):readOnly?await previewWorkspaceItems().then(items=>({items,error:null})).catch(()=>({items:[],error:'미리보기 자료를 불러오지 못했습니다.'})):{items:[],error:null};
 return <WorkFrame>
 <div className={styles.workspaceLead}><div/>{session.canEdit&&<Link href="/work/new">＋ 새 자료</Link>}</div>
 {readOnly&&<p className={styles.notice}><a href="https://globaltrend-six.vercel.app/work">운영 작업 공간 열기 ↗</a></p>}
 {notice&&<p className={styles.notice} role="status">{notice==='draft_saved'?'새 자료를 저장했습니다. 목록에서 공개할 수 있습니다.':notice==='imported'?'법제 자료를 등록했습니다. 목록에서 공개할 수 있습니다.':notice==='save_failed'?'자료를 등록하지 못했습니다. 입력 내용과 계정 상태를 확인해 주세요.':notice==='stale_package'?'자료 판본이 변경됐습니다. 최신 제출 자료를 다시 확인해 주세요.':notice==='invalid_login'?'이메일과 비밀번호를 확인해 주세요.':notice==='login_required'?'팀 계정으로 로그인해 주세요.':'작업 결과를 목록에서 확인해 주세요.'}</p>}
 {!session.user&&<section className={styles.card}><h2>팀 계정 로그인</h2><p>수정·공개는 팀 계정으로 로그인해 주세요. <Link href="/team">로그인 없이 제출 자료 보기</Link></p><form action={signIn} className={styles.form}><label>이메일<input name="email" type="email" autoComplete="email" required/></label><label>비밀번호<input name="password" type="password" autoComplete="current-password" required/></label><button>로그인</button></form></section>}
 {session.user&&<div className={styles.identity}><span>{session.user.email} · {session.role==='admin'?'총괄 관리자':session.role==='editor'?'팀 편집자':'팀 권한 없음'}</span><form action={signOut}><button>로그아웃</button></form></div>}
 {result.error&&<p className={styles.error} role="alert">{result.error}</p>}
 {(session.canEdit||readOnly)&&<Workspace items={result.items} canEdit={session.canEdit||readOnly} canPublish={session.canPublish||readOnly} readOnly={readOnly} executeAction={executeWorkspaceAction} initialKind={kind==='law'?'law':kind==='trend'?'trend':'all'}/>}
 {session.user&&!session.canEdit&&<p className={styles.card}>이 계정에는 자료 편집 권한이 없습니다. <Link href="/team">자료 열람 화면으로 이동</Link></p>}
 </WorkFrame>;
}
