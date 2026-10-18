import Link from "next/link";
import { createClient } from "../../../lib/supabase/server";
import { buildLegalReviewPackages, type LegalReviewPackage } from "../../../lib/legal-release";
import { importLegalReview, advanceLegalReview } from "./actions";
import styles from "../work.module.css";

export const dynamic = "force-dynamic";
const notices: Record<string,string> = {
 imported:"검수 대기로 등록했습니다. 같은 자료를 다시 가져와도 중복 생성되지 않습니다.",
 verified:"이 판본의 번역·비교 자료를 승인했습니다. 아직 공개되지 않았습니다.",
 published:"법제 자료를 발행했습니다. 공개 법제 화면에서 확인하실 수 있습니다.",
 preview_readonly:"이 Preview는 읽기 전용입니다. DB 등록·승인·발행은 운영 화면에서 진행합니다.",
 save_failed:"저장하지 못했습니다. DB 마이그레이션·권한·현재 상태를 확인해 주세요.",
 permission_denied:"이 작업을 수행할 팀 권한이 없습니다.",
 stale_package:"자료 판본이 변경됐습니다. 화면을 새로고침하고 다시 확인해 주세요.",
 confirmation_required:"해당 판본의 내용과 원문·이용조건을 확인한 뒤 체크해 주세요.",
};
const state: Record<string,string> = {draft:"검수 대기",verified:"승인됨",published:"발행됨",superseded:"구판"};
const availability: Record<string,string> = {translation:"한국어 전문 초안 포함",official_index:"한국 공식 원문 색인 · 본문은 공식 사이트 열람",withheld:"GDPR 본문 미포함 · 외부 보관 기록만 있음",missing:"번역 본문 미포함"};

export default async function LegalWorkPage({searchParams}:{searchParams:Promise<{notice?:string}>}) {
 const {notice} = await searchParams;
 const db = await createClient();
 const {data:{user}} = await db.auth.getUser();
 const {data:member} = user ? await db.from("team_memberships").select("role,is_active").eq("user_id",user.id).maybeSingle() : {data:null};
 const canEdit = member?.is_active && ["admin","editor"].includes(member.role);
 const admin = member?.is_active && member.role === "admin";
 const readOnly = process.env.VERCEL_ENV === "preview";
 const packages = buildLegalReviewPackages();
 const result = canEdit ? await db.from("law_versions").select("id,status,content_hash,review_payload,reviewed_at").not("review_payload","is",null).order("created_at",{ascending:false}) : {data:[],error:null};
 return <main className={styles.page}><header className={styles.header}><Link href="/">← 작업자 홈</Link><h1>법제 검수·발행</h1><Link href="/public/laws">공개 법제 보기 →</Link></header><div className={styles.wrap}>
  {notice && notices[notice] && <p className={styles.notice} role="status">{notices[notice]}</p>}
  {readOnly && <p className={styles.notice}>Preview는 제출 초안을 표시하며 DB 쓰기는 하지 않습니다.</p>}
  <p>번역 전문과 17개 비교 기준을 하나의 판본으로 확인합니다. 자료 등록 → 원문·내용·이용조건 검수 → 승인 → 발행 순서입니다. GitHub 병합만으로 발행되지 않습니다.</p>
  {!canEdit && <p className={styles.card}><Link href="/work">팀 계정으로 로그인</Link>하면 자료를 등록·검수할 수 있습니다. <Link href="/team">제출 자료 열람</Link>은 로그인 없이 가능합니다.</p>}
  <section className={styles.queue}><h2>저장소의 최신 제출 자료</h2>{packages.map(p => {
    const registered = result.data?.some(row => row.content_hash === p.contentHash);
    return <article className={styles.card} key={p.recordId}><h3>{p.jurisdiction} · {p.instrument.title}</h3><p>{availability[p.availability]} · 비교 기준 {p.cells.length}개</p><p>{p.versionLabel}</p>
     <Link href={p.document ? `/legal-translation/${p.document.id}` : "/legal-drafts"}>제출 내용 확인 →</Link>
     <form action={importLegalReview}><input type="hidden" name="record_id" value={p.recordId}/><input type="hidden" name="content_hash" value={p.contentHash}/><button disabled={!canEdit || readOnly || registered}>{registered ? "같은 판본 등록됨" : "이 판본을 검수 대기로 등록"}</button></form></article>;
  })}</section>
  <section className={styles.queue}><h2>DB에 등록된 검수 판본</h2>
   {result.error && <p role="alert">법제 검수 DB 연결이 준비되지 않았습니다. 이 PR의 법제 발행 마이그레이션 적용이 필요합니다.</p>}
   {!result.error && !result.data?.length && <p>아직 등록된 판본이 없습니다.</p>}
   {result.data?.map(row => {const p = row.review_payload as LegalReviewPackage; return <article className={styles.card} key={row.id}><h3>{p.jurisdiction} · {p.instrument.title} · {state[row.status] ?? row.status}</h3><p>{p.versionLabel}</p><p>{availability[p.availability]}</p><Link href={`/work/legal/${row.id}`}>이 DB 판본의 번역·17개 비교 내용 확인 →</Link>
    {admin && ["draft","verified"].includes(row.status) && <form action={advanceLegalReview} className={styles.form}><input type="hidden" name="id" value={row.id}/><input type="hidden" name="content_hash" value={row.content_hash}/><input type="hidden" name="next" value={row.status === "draft" ? "verified" : "published"}/><label><input type="checkbox" name="checked" value="yes" required/>이 판본의 원문·번역 범위·비교 17개·이용조건을 확인했습니다.</label><button disabled={readOnly}>{row.status === "draft" ? "검수 후 승인" : "공개 발행"}</button></form>}
   </article>;})}
  </section>
 </div></main>;
}
