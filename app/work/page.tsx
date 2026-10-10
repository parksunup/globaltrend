import Link from "next/link";
import { createClient } from "../../lib/supabase/server";
import { advanceReport, createDraft, saveDraft, signIn, signOut } from "./actions";
import styles from "./work.module.css";

export const dynamic = "force-dynamic";

const noticeText: Record<string, string> = {
  invalid_login: "이메일 또는 비밀번호를 확인해 주세요.",
  login_required: "작업을 계속하려면 로그인해 주세요.",
  permission_denied: "이 계정에는 해당 작업 권한이 없습니다.",
  invalid_draft: "필수 내용과 원문 주소를 확인해 주세요.",
  duplicate: "이 출처에 같은 원문 주소가 이미 등록되어 있습니다.",
  save_failed: "초안을 저장하지 못했습니다. 입력 내용과 권한을 확인해 주세요.",
  transition_failed: "상태를 변경하지 못했습니다. 자료의 현재 상태와 권한을 확인해 주세요.",
  draft_saved: "초안을 저장했습니다. 아직 공개되지 않았습니다.",
  in_review: "검수 대기로 보냈습니다.",
  approved: "승인했습니다. 아직 공개되지 않았습니다.",
  published: "발행했습니다. 공개 동향과 검색에서 확인할 수 있습니다.",
  preview_readonly: "PR Preview에서는 운영 DB에 쓰지 않습니다. 병합 후 운영 화면에서 작성해 주세요.",
};
const statusText: Record<string, string> = {
  draft: "초안", in_review: "검수 대기", approved: "승인됨", published: "발행됨", excluded: "제외",
};

export default async function WorkPage({ searchParams }: { searchParams: Promise<{ notice?: string }> }) {
  const { notice } = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: membership } = user
    ? await supabase.from("team_memberships").select("role,is_active").eq("user_id", user.id).maybeSingle()
    : { data: null };
  const role = membership?.is_active ? membership.role as string : null;
  const canEdit = role === "admin" || role === "editor";
  const canPublish = role === "admin";
  const readOnlyPreview = process.env.VERCEL_ENV === "preview";
  const [sourcesResult, reportsResult] = canEdit ? await Promise.all([
    supabase.from("sources").select("id,name").eq("is_active", true).order("name"),
    supabase.from("reports").select("id,source_item_id,title_ko,one_line_summary_ko,detailed_summary_ko,jurisdictions,topics,status,created_at,published_at")
      .order("created_at", { ascending: false }).limit(100),
  ]) : [{ data: [] }, { data: [] }];
  const sources = sourcesResult.data ?? [];
  const reports = reportsResult.data ?? [];
  const sourceIds = reports.map((report) => report.source_item_id);
  const { data: sourceItems } = sourceIds.length
    ? await supabase.from("source_items").select("id,title_original,canonical_url,published_at").in("id", sourceIds)
    : { data: [] };
  const originals = new Map((sourceItems ?? []).map((item) => [item.id, item]));

  return <main className={styles.page}>
    <header className={styles.header}><Link href="/">← 작업자 홈</Link><h1>동향 작성·발행</h1><Link href="/public">공개 동향 보기 →</Link></header>
    <div className={styles.wrap}>
      {notice && noticeText[notice] && <p className={styles.notice} role="status">{noticeText[notice]}</p>}
      {readOnlyPreview && <p className={styles.notice}>이 PR Preview는 읽기 전용입니다. 운영 Supabase에 초안·승인을 저장하지 않습니다.</p>}
      {!user ? <section className={styles.card}>
        <h2>팀 계정 로그인</h2><p>자료 작성과 발행에만 로그인이 필요합니다. 공개 동향과 검수 목록은 로그인 없이 볼 수 있습니다.</p>
        <form action={signIn} className={styles.form}>
          <label>이메일<input name="email" type="email" autoComplete="email" required /></label>
          <label>비밀번호<input name="password" type="password" autoComplete="current-password" required /></label>
          <button type="submit">로그인</button>
        </form>
      </section> : <>
        <div className={styles.identity}><span>{user.email} · {role ? `권한: ${role}` : "팀 권한 없음"}</span><form action={signOut}><button type="submit">로그아웃</button></form></div>
        {!canEdit ? <section className={styles.card}><h2>작성 권한이 없습니다</h2><p>관리자 또는 편집자 권한이 있는 팀 계정으로 접속해 주세요.</p></section> : <>
          <section className={styles.card}>
            <h2>새 동향 초안 등록</h2><p>공식 원문을 확인한 뒤 작성해 주세요. 저장해도 곧바로 공개되지 않습니다.</p>
            <form action={createDraft} className={styles.form}>
              <label>수집 출처<select name="source_id" required>{sources.map((source) => <option key={source.id} value={source.id}>{source.name}</option>)}</select></label>
              {sources.length === 0 && <p>활성 수집 출처가 없습니다. 출처를 먼저 등록해야 합니다.</p>}
              <label>공식 원문 주소<input name="canonical_url" type="url" placeholder="https://…" required /></label>
              <label>원문 제목<input name="original_title" maxLength={500} required /></label>
              <label>한국어 제목<input name="title_ko" maxLength={500} required /></label>
              <label>한국어 한 줄 요약<textarea name="summary_ko" maxLength={3000} required rows={3} /></label>
              <label>상세 내용<textarea name="details_ko" maxLength={20000} rows={5} /></label>
              <div className={styles.fields}><label>원문 게시일<input name="source_published_date" type="date" /></label><label>국가·지역 (쉼표로 구분)<input name="jurisdictions" placeholder="EU, 영국" /></label></div>
              <label>주제 (쉼표로 구분)<input name="topics" placeholder="아동, 인공지능" /></label>
              <button type="submit" disabled={sources.length === 0 || readOnlyPreview}>초안 저장</button>
            </form>
          </section>
          <section className={styles.queue}><div><h2>등록된 동향</h2><p>초안 → 검수 대기 → 승인 → 발행 순서로 진행합니다. 발행된 자료만 공개 페이지에 나타납니다.</p></div>
            {reportsResult.error && <p role="alert">자료 목록을 읽지 못했습니다. 권한과 DB 상태를 확인해 주세요.</p>}
            {reports.length === 0 && !reportsResult.error && <p className={styles.card}>아직 등록된 동향이 없습니다.</p>}
            {reports.map((report) => {
              const original = originals.get(report.source_item_id);
              return <article className={styles.card} key={report.id}>
                <div className={styles.itemHead}><strong>{report.title_ko}</strong><span>{statusText[report.status] ?? report.status}</span></div>
                <p>{report.one_line_summary_ko}</p>
                {original && <p><a href={original.canonical_url} target="_blank" rel="noopener noreferrer">공식 원문 확인 ↗</a> · {original.title_original}</p>}
                {report.status === "published" && <Link href={`/public/trends/${report.id}`}>공개 상세 보기 →</Link>}
                {["draft", "in_review"].includes(report.status) && <details className={styles.editor}><summary>초안 수정</summary>
                  <form action={saveDraft} className={styles.form}>
                    <input name="id" type="hidden" value={report.id} />
                    <label>한국어 제목<input name="title_ko" defaultValue={report.title_ko} maxLength={500} required /></label>
                    <label>한 줄 요약<textarea name="summary_ko" defaultValue={report.one_line_summary_ko ?? ""} maxLength={3000} required rows={3} /></label>
                    <label>상세 내용<textarea name="details_ko" defaultValue={report.detailed_summary_ko ?? ""} maxLength={20000} rows={5} /></label>
                    <label>국가·지역<input name="jurisdictions" defaultValue={report.jurisdictions?.join(", ") ?? ""} /></label>
                    <label>주제<input name="topics" defaultValue={report.topics?.join(", ") ?? ""} /></label>
                    <button type="submit" disabled={readOnlyPreview}>수정 저장</button>
                  </form>
                </details>}
                {report.status === "draft" && <form action={advanceReport}><input type="hidden" name="id" value={report.id} /><input type="hidden" name="next" value="in_review" /><button type="submit" disabled={readOnlyPreview}>검수 요청</button></form>}
                {report.status === "in_review" && canPublish && <form action={advanceReport}><input type="hidden" name="id" value={report.id} /><input type="hidden" name="next" value="approved" /><button type="submit" disabled={readOnlyPreview}>근거 확인 후 승인</button></form>}
                {report.status === "approved" && canPublish && <form action={advanceReport}><input type="hidden" name="id" value={report.id} /><input type="hidden" name="next" value="published" /><button type="submit" disabled={readOnlyPreview}>공개 발행</button></form>}
              </article>;
            })}
          </section>
        </>}
      </>}
    </div>
  </main>;
}
