import Link from "next/link";
import { createClient } from "../../../lib/supabase/server";
import { buildLegalReviewPackages, type LegalReviewPackage } from "../../../lib/legal-release";
import { importLegalReview, publishLegalReviews } from "./actions";
import { PublicationSelection, PublicationCheckbox, BulkPublication, PublishButton } from "../publication-selection";
import styles from "../work.module.css";

export const dynamic = "force-dynamic";
const notices: Record<string,string> = {
 imported:"자료를 등록했습니다. 같은 판본은 중복 생성되지 않습니다.",
 published:"법제 자료를 공개했습니다.",
 preview_readonly:"화면 확인용입니다. 실제 자료를 등록·공개하려면 운영 작업 공간을 이용해 주세요.",
 save_failed:"등록하지 못했습니다. 자료와 계정 상태를 확인해 주세요.",
 permission_denied:"이 작업을 수행할 팀 권한이 없습니다.",
 stale_package:"자료 판본이 변경됐습니다. 새로고침 후 다시 선택해 주세요.",
 invalid_selection:"공개할 자료를 선택해 주세요. 한 번에 최대 100건까지 처리합니다.",
};
const state: Record<string,string> = {draft:"공개 준비",verified:"공개 준비",published:"공개 중",superseded:"이전 판본"};
const availability: Record<string,string> = {translation:"한국어 전문 포함",official_index:"한국 공식 원문 색인 · 본문은 공식 사이트 열람",withheld:"전문 없음 · 비교표만 포함",missing:"번역 본문 미포함"};

export default async function LegalWorkPage({searchParams}:{searchParams:Promise<{notice?:string; published?:string; already?:string; failed?:string}>}) {
 const {notice,published,already,failed} = await searchParams;
 const db = await createClient();
 const {data:{user}} = await db.auth.getUser();
 const {data:member} = user ? await db.from("team_memberships").select("role,is_active").eq("user_id",user.id).maybeSingle() : {data:null};
 const canEdit = member?.is_active && ["admin","editor"].includes(member.role);
 const admin = member?.is_active && member.role === "admin";
 const readOnly = process.env.VERCEL_ENV === "preview";
 const packages = buildLegalReviewPackages();
 const result = canEdit ? await db.from("law_versions").select("id,legal_instrument_id,status,content_hash,review_payload").not("review_payload","is",null).order("created_at",{ascending:false}) : {data:[],error:null};
 const seenInstruments = new Set<string>();
 const selectable = (result.data ?? []).filter(row => {
   if (!["draft","verified"].includes(row.status) || !row.content_hash || seenInstruments.has(row.legal_instrument_id)) return false;
   seenInstruments.add(row.legal_instrument_id); return true;
 });
 const selectableIds = new Set(selectable.map(row => row.id));
 const selectionValue = (row:{id:string;content_hash:string}) => JSON.stringify({id:row.id,contentHash:row.content_hash});
 const failedIds = new Set((failed ?? "").split(","));
 return <main className={styles.page}><header className={styles.header}><Link href="/work">← 작업 공간 · 동향</Link><h1>법제 자료 관리</h1><Link href="/public/laws">공개 법제 보기 →</Link></header><div className={styles.wrap}>
  {notice && notices[notice] && <p className={styles.notice} role="status">{notices[notice]}</p>}
  {readOnly && <p className={styles.notice}>화면 확인용 · 실제 사이트에 저장하지 않습니다. 운영 작업 공간에서 등록·공개해 주세요.</p>}
  {published !== undefined && <div className={styles.notice} role="status"><strong>{Number(published)||0}건 공개 완료 · 이미 공개된 자료 {Number(already)||0}건</strong>{failed && <p>일부 자료는 공개하지 못했습니다. 아래 표시된 자료만 확인하고 다시 선택해 주세요.</p>}</div>}
  <p>한국어 전문과 17개 기준 비교표를 판본별로 관리합니다. 관리자는 자료를 선택해 한 번에 공개할 수 있습니다. 검토 기록은 내부에 보관합니다.</p>
  {!canEdit && <p className={styles.card}><Link href="/work">팀 계정으로 로그인</Link>하면 자료를 관리할 수 있습니다. <Link href="/team">제출 자료 보기</Link>는 로그인 없이 가능합니다.</p>}
  <section className={styles.queue} id="registered"><h2>등록된 법제 자료</h2>
   {result.error && <p role="alert">자료 목록을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.</p>}
   {!result.error && !result.data?.length && <p>등록된 판본이 없습니다. 아래의 제출 자료를 열어 등록할 수 있습니다.</p>}
   <PublicationSelection key={selectable.map(selectionValue).join("|")}>
   {admin && <BulkPublication values={selectable.map(selectionValue)} action={publishLegalReviews} disabled={readOnly}/>}
   {result.data?.map(row => {const p = row.review_payload as LegalReviewPackage; return <article className={styles.card} key={row.id} id={`law-${row.id}`}>
    {failedIds.has(row.id) && <p className={styles.error} role="alert">이 자료를 공개하지 못했습니다. 판본과 현재 상태를 확인한 후 다시 시도해 주세요.</p>}
    {admin && selectableIds.has(row.id) && <PublicationCheckbox value={selectionValue(row)} title={p.instrument.title} disabled={readOnly}/>}
    <div className={styles.itemHead}><strong>{p.jurisdiction} · {p.instrument.title}</strong><span>{state[row.status] ?? row.status}</span></div><p>{p.versionLabel}</p><p>{availability[p.availability]}</p>{["draft","verified"].includes(row.status) && !selectableIds.has(row.id) && <p>더 최신의 대기 판본이 있습니다. 위의 최신 판본에서 공개해 주세요.</p>}<Link href={`/work/legal/${row.id}`}>전문·17개 기준 비교표 보기 →</Link>
    {admin && ["draft","verified"].includes(row.status) && <form action={publishLegalReviews}><input type="hidden" name="selection" value={selectionValue(row)}/><PublishButton disabled={readOnly}/></form>}
   </article>;})}
   </PublicationSelection>
  </section>
  <details className={styles.card}><summary>제출 자료에서 법제 판본 등록</summary><p>아직 등록되지 않은 판본만 추가하세요. 같은 판본은 중복 등록되지 않습니다.</p>{packages.map(p => {
    const registered = result.data?.some(row => row.content_hash === p.contentHash);
    return <article className={styles.card} key={p.recordId}><h3>{p.jurisdiction} · {p.instrument.title}</h3><p>{availability[p.availability]} · 비교 기준 {p.cells.length}개</p><p>{p.versionLabel}</p>
     <Link href={p.document ? `/legal-translation/${p.document.id}` : "/legal-drafts"}>제출 내용 보기 →</Link>
     <form action={importLegalReview}><input type="hidden" name="record_id" value={p.recordId}/><input type="hidden" name="content_hash" value={p.contentHash}/><button disabled={!canEdit || readOnly || registered}>{registered ? "등록된 판본" : "자료 등록"}</button></form></article>;
  })}</details>
 </div></main>;
}
