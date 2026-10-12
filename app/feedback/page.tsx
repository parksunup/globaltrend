import Link from "next/link";
import { loadSubmittedStories } from "../../lib/public-submission-preview";
import FeedbackList from "../components/feedback-list";
import styles from "../components/feedback.module.css";
import { FeedbackQueryError, getPublicFeedback, parseFeedbackQuery } from "../../lib/public-feedback";

export const dynamic = "force-dynamic";

export default async function FeedbackPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const values = await searchParams;
  const params = new URLSearchParams();
  for (const key of ["branch", "item", "offset", "limit"]) if (typeof values[key] === "string") params.set(key, values[key]);
  if (!params.has("branch")) {
    const ref = process.env.VERCEL_GIT_COMMIT_REF ?? "";
    params.set("branch", ref.includes("legal-corpus") ? "feat/legal-corpus-foundation" : "feat/trend-source-contracts");
  }
  let data: Awaited<ReturnType<typeof getPublicFeedback>> | undefined;
  let error = "";
  try { data = await getPublicFeedback(parseFeedbackQuery(params)); }
  catch (reason) { error = reason instanceof FeedbackQueryError ? reason.message : "저장된 피드백을 불러오지 못했습니다. 아래 조회 버튼으로 다시 시도해 주세요."; }
  function pageHref(offset: number) {
    const next = new URLSearchParams(params);
    next.set("offset", String(offset));
    return `/feedback?${next}`;
  }
  const labels = Object.fromEntries(loadSubmittedStories().map((story) => [`fixture-${story.id}`, story.title]));
  return <main className={styles.page}>
    <Link href="/team">← 검수 화면으로</Link>
    <h1>저장된 피드백</h1>
    <p className={styles.note}>로그인이나 Supabase 권한 없이 의견을 읽을 수 있습니다. 같은 브랜치의 과거 버전에 남긴 의견도 함께 표시합니다.</p>
    <p className={styles.warning}>의견은 누구나 볼 수 있습니다. 작성자 이름은 본인 확인을 거친 이름이 아닙니다. 의견이 목록에 있다는 이유만으로 반영되거나 검수 완료된 것은 아닙니다.</p>
    <nav className={styles.links} aria-label="담당자별 피드백">
      <Link href="/feedback?branch=feat%2Ftrend-source-contracts">동향 담당 의견</Link>
      <Link href="/feedback?branch=feat%2Flegal-corpus-foundation">법제 담당 의견</Link>
      {process.env.VERCEL_GIT_COMMIT_REF && <Link href={`/feedback?branch=${encodeURIComponent(process.env.VERCEL_GIT_COMMIT_REF)}`}>이 Preview에서 남긴 의견</Link>}
    </nav>
    <details className={styles.advancedFilter}><summary>브랜치·항목으로 자세히 찾기</summary><form className={styles.filter} action="/feedback" method="get">
      <label>작업 브랜치<input name="branch" defaultValue={params.get("branch") ?? ""} placeholder="예: feat/trend-source-contracts" required maxLength={160} /></label>
      <label>항목 ID (선택)<input name="item" defaultValue={params.get("item") ?? ""} placeholder="비워 두면 이 브랜치의 모든 항목을 조회합니다" maxLength={240} /></label>
      <button type="submit">피드백 조회 · 새로고침</button>
    </form></details>
    {error && <p role="alert" className={styles.error}>{error}</p>}
    {data && <>
      <div className={styles.links}><a href={`/api/feedback?${params}`}>Codex용 JSON으로 보기</a></div>
      <p className={styles.note}>브랜치: <code>{data.branch}</code>{data.item && <> · 항목: <code>{data.item}</code></>} · 오래된 의견부터 표시</p>
      {data.feedback.length ? <FeedbackList feedback={data.feedback} labels={labels} /> : <p>이 조회 범위에 저장된 피드백이 없습니다.</p>}
      <nav className={styles.pagination} aria-label="피드백 페이지">
        {data.offset > 0 && <Link href={pageHref(Math.max(0, data.offset - data.limit))}>이전 의견</Link>}
        {data.nextOffset !== null && <Link href={pageHref(data.nextOffset)}>다음 의견</Link>}
      </nav>
    </>}
  </main>;
}
