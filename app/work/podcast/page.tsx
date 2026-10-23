import Link from "next/link";
import { createClient } from "../../../lib/supabase/server";
import WorkFrame from "../frame";
import PodcastUploadForm from "./upload-form";
import styles from "../work.module.css";

export const dynamic = "force-dynamic";

export default async function PodcastWorkPage() {
  const db = await createClient();
  const { data: { user } } = await db.auth.getUser();
  if (!user) return <WorkFrame active="podcast"><section className={styles.card}><h1>주간 팟캐스트</h1><p>총괄 관리자 계정으로 로그인해 주세요.</p><Link href="/work">작업 공간 로그인 →</Link></section></WorkFrame>;

  const { data: member } = await db.from("team_memberships")
    .select("role,is_active").eq("user_id", user.id).maybeSingle();
  if (!member?.is_active || member.role !== "admin") {
    return <WorkFrame active="podcast"><section className={styles.card}><h1>주간 팟캐스트</h1><p>오디오 발행은 총괄 관리자 권한이 필요합니다.</p></section></WorkFrame>;
  }

  const { data: reports, error } = await db.from("reports")
    .select("id,title_ko,one_line_summary_ko,published_at")
    .eq("status", "published").order("published_at", { ascending: false }).limit(100);

  return <WorkFrame active="podcast">
    <header className={styles.workspaceLead}><div><p>WEEKLY PODCAST</p><h1>오디오 게시</h1><span>NotebookLM에서 내려받은 파일과 이미 공개된 동향을 연결합니다.</span></div></header>
    {error ? <p role="alert" className={styles.error}>공개 동향 목록을 불러오지 못했습니다.</p> :
      <PodcastUploadForm reports={reports ?? []} />}
  </WorkFrame>;
}
