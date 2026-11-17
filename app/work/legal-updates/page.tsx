import Link from 'next/link';
import WorkFrame from '../frame';
import ReviewControls from './review-controls';
import styles from '../work.module.css';
import watch from './watch.module.css';
import {workspaceSession} from '../../../lib/workspace-data';
import {buildLegalReviewPackages,type LegalReviewPackage} from '../../../lib/legal-release';
import {loadWatchReport} from '../../../lib/legal-watch-data';
import {lawImpact,pendingEvents,reviewPacket,type WatchLaw} from '../../../lib/legal-watch';
export const dynamic='force-dynamic';
export const maxDuration=60;
export const metadata={title:'법령 변경 점검 · 작업실'};
const labels={changed:'변경 후보 발견',unchanged:'직전 원문과 동일',baseline:'초기 기준 확인 필요',partial:'목차·유효성만 확인',error:'공식 원문 확인 실패'};
const failure=(code:string|null)=>code==='http_403'?'공식 출처 또는 연결 경로에서 접근이 거부되었습니다.':code==='http_503'?'출처 또는 연결 경로가 일시적으로 응답하지 않았습니다.':code==='http_202'?'본문 대신 빈 응답 또는 준비 중 응답을 받았습니다.':code==='incomplete_article_structure'?'전체 조문 구조를 확인하지 못했습니다. 일부 화면만으로 변경 없음을 판단하지 않습니다.':code==='unexpected_article_loss'?'조문 수가 급감해 불완전 수집 여부를 확인해야 합니다.':'원문 응답·형식·연결을 확인하지 못했습니다.';
export default async function LegalUpdates(){
 const preview=process.env.VERCEL_ENV==='preview';let session:Awaited<ReturnType<typeof workspaceSession>>|undefined;
 try{session=await workspaceSession();}catch{ /* Missing connection does not expose private records. */ }
 if(!session?.canEdit)return <WorkFrame active="legal-updates"><h1>법령 변경 점검</h1><p><Link href="/work">팀 계정으로 로그인</Link>한 뒤 확인해 주세요. 법제 수정·공개 권한은 기존 작업실과 같습니다.</p></WorkFrame>;
 const loaded=await loadWatchReport({allowRemote:!preview&&session?.canEdit===true});const {report}=loaded;
 const packages=buildLegalReviewPackages();
 const changed=report.laws.filter(l=>pendingEvents(l).some(e=>e.kind==='source_changed')).length,failed=report.laws.filter(l=>l.status==='error').length,partial=report.laws.filter(l=>l.status==='partial').length;
 const displayTime=(value?:string|null)=>value?new Date(value).toLocaleString('ko-KR',{timeZone:'Asia/Seoul'})+' KST':'성공 기록 없음';
 return <WorkFrame active="legal-updates"><h1>법령 변경 점검</h1><p>공식 출처의 변경 후보를 확인하고 번역과 비교표 수정안을 준비합니다. 점검 결과가 법률 개정의 확정·검수 완료·공개 승인을 뜻하지는 않습니다.</p>
  <section className={styles.notice} aria-label="점검 결과 출처"><strong>{loaded.source==='github'?'정기 실행 결과':'포함된 초기 수동 점검 결과'}</strong><p>점검 시각: {displayTime(report.generatedAt)} · 대상 {report.laws.length}개 기본법 · 변경 후보 검토 대기 {changed}개 · 확인 실패 {failed}개 · 제한된 확인 {partial}개</p>{loaded.runUrl&&<a href={loaded.runUrl} target="_blank" rel="noopener noreferrer">정기 실행 기록 ↗</a>}{loaded.source==='bundled'&&<p role="status">정기 실행 결과 연결 전이거나 연결을 확인하지 못해 초기 점검 자료를 표시합니다. 최신 결과라고 간주하지 마세요. {loaded.connection==='not_configured'?'운영 서버의 GitHub Actions 읽기 연결이 필요합니다.':'정기 실행·읽기 권한·최근 실행 실패 여부를 확인해 주세요.'}</p>}{loaded.stale&&<p role="alert">점검 결과가 14일 이상 지났습니다. 최신 점검이 필요합니다.</p>}{preview&&<p>Preview에서는 포함된 자료를 검토하고 요청문을 받을 수 있습니다. 실제 저장·공개는 운영 작업실에서 진행합니다.</p>}</section>
  <p><Link href="/work?role=legal">법제 작업실로 돌아가기</Link> · <a href="https://github.com/parksunup/globaltrend/actions/workflows/legal-amendment-watch.yml" target="_blank" rel="noopener noreferrer">정기 점검·수동 재실행 기록 ↗</a></p>
  <p className={watch.caution}>현재 등록한 기본법 본문·메타데이터 범위의 점검입니다. 모든 시행예정 개정·하위법령·관련 판례까지 자동 추적하는 것은 아닙니다. 첫 기준 판본은 담당자 확인이 필요합니다.</p>
  {report.laws.map((law:WatchLaw)=>{
   const p=packages.find(p=>p.jurisdiction===law.jurisdiction&&(p.document?.id===law.id||p.recordId.endsWith('-'+law.id)));const impact=lawImpact(law,p),events=pendingEvents(law),packet=reviewPacket(law,p,report);
   return <section key={law.id} id={law.id} className={`${styles.card} ${watch.card}`} aria-labelledby={'title-'+law.id}>
    <div className={watch.heading}><h2 id={'title-'+law.id}>{law.name}</h2><strong>{law.coverage==='fixed_official_edition'?' 고정 판본만 확인':labels[law.status]}</strong></div><p>{law.scope}</p><p><a href={law.url} target="_blank" rel="noopener noreferrer">공식 출처 ↗</a> · 최근 성공: {displayTime(law.lastSuccessAt)}</p>
    {law.acquiredUrl&&law.acquiredUrl!==law.url&&<p><a href={law.acquiredUrl} target="_blank" rel="noopener noreferrer">확보한 공식 본문 ↗</a></p>}
    {law.coverage==='fixed_official_edition'&&<p className={watch.caution}>최신 통합 원문 요청은 실패해 고정된 공식 판본을 확보했습니다. 본문을 대조할 수 있지만 최신 판본·후속 개정 확인이 끝났다는 뜻은 아닙니다. 원 요청 오류: {law.primaryError}</p>}
    {law.status==='error'&&<p role="status">{failure(law.error)} 변경이 없다는 뜻이 아닙니다. 코드: {law.error}</p>}
    {law.coverage==='index_and_status_only'&&<p className={watch.caution}>공식 목차와 유효성 메타데이터만 대조했습니다. 법문 본문 변경은 자동 대조하지 못하므로 별도로 확인해야 합니다.</p>}
    <p>현재 확인 판본: {law.version||'확인 필요'} · 기존 제출 판본: {p?.versionLabel||'자료에서 확인'}</p>
    {law.baselineOrigin!=='selected_edition'&&<p>기존 선정 판본과 같은 원문인지 아직 확인되지 않았습니다. 최초 수집 기준과 기존 번역을 대조해 주세요.</p>}
    <p>미완료 검토 기록 {events.length}개 · 영향 후보 비교 기준 {impact.cells.length}개{impact.fullReview?' · 전체 영향 범위 검토 필요':''}</p>
    {events.length>0&&<details><summary>변경 식별자와 비교 기준 보기</summary>{events.map(event=><div key={event.id}><p>{event.kind==='baseline_review'?'초기 기준 검토':'공식 출처 변경 후보'} · {displayTime(event.createdAt)}</p><dl><dt>추가</dt><dd>{event.changes.added.join(', ')||'없음'}</dd><dt>삭제</dt><dd>{event.changes.removed.join(', ')||'없음'}</dd><dt>본문 변경</dt><dd>{event.changes.modified.join(', ')||'없음'}</dd><dt>판본·메타데이터</dt><dd>{event.changes.metadataChanged?'변경 후보 있음':'검출 없음'}</dd></dl></div>)}<ul>{impact.cells.map(cell=><li key={cell.id}><strong>{cell.criterionName}</strong>: {cell.articleNumbers.join(', ')}</li>)}</ul><p>관련 조항의 번호를 기준으로 찾은 검토 후보입니다. 실제 법적 영향은 담당자가 확인해야 합니다. 미매핑 조항·부칙·판본 변경은 전체 기준 검토로 넘깁니다.</p></details>}
    {(events.length>0||law.status==='error'||law.status==='partial')&&<ReviewControls lawId={law.id} packet={packet}/>}
    <p><Link href="/work?role=legal">법제 작업실에서 해당 법률·판본과 수정본 확인 →</Link></p>
   </section>;
  })}
  <section className={`${styles.card} ${watch.card}`}><h2>수정안 검토 후 공개</h2><ol><li>변경 후보의 공식 원문과 현행·시행예정 판본을 확인합니다.</li><li>위 요청문과 검토 패킷으로 기존 법제 담당 Codex에서 수정안을 작성합니다. 본문을 추정해 자동 번역하지 않습니다.</li><li>번역 전문과 비교표를 각각 검토하고, 조건·예외·조문 연결·판본을 확인합니다.</li><li>기존 작업실에 수정본을 저장한 뒤 내용 차이를 확인하고 별도로 공개합니다. 기존 공개본과 이력은 보존됩니다.</li><li>점검 이벤트 ID·공식 원문 해시·번역 커밋과 두 검토 완료 기록을 reviews.json에 남기면 다음 점검에서 해당 대기 표시가 해제됩니다. 기록 자체가 공개를 실행하지는 않습니다.</li></ol></section>
 </WorkFrame>;
}
