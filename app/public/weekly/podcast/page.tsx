import Link from "next/link";
import { createClient } from "../../../../lib/supabase/server";
import { PublicHeader, PublicFooter } from "../../public-navigation";
import styles from "../../public.module.css";

export const dynamic = "force-dynamic";

export default async function PublishedPodcastsPage() {
  const db = await createClient();
  const { data: episodes, error } = await db.from("weekly_podcast_episodes")
    .select("issue_key,title,description,week_start,week_end,report_ids,audio_path,audio_mime_type,published_at")
    .eq("status", "published").order("published_at", { ascending: false }).limit(52);
  const episodeRows = episodes ?? [];
  const ids = [...new Set(episodeRows.flatMap(episode => episode.report_ids ?? []))];
  const { data: reports } = ids.length ? await db.from("reports")
    .select("id,title_ko,one_line_summary_ko").eq("status", "published").in("id", ids) : { data: [] };
  const reportMap = new Map((reports ?? []).map(report => [report.id, report]));

  return <main className={styles.site}>
    <PublicHeader active="/public/weekly" />
    <section className={styles.searchPage}>
      <div className={styles.searchIntro}><p className={styles.overline}>WEEKLY PODCAST</p><h1>주간 동향 팟캐스트</h1><p>발행된 주간호에 포함된 동향을 두 진행자의 대화로 들어보세요.</p></div>
      {error ? <p role="alert">팟캐스트를 불러오지 못했습니다.</p> : episodeRows.length ? episodeRows.map(episode => {
        const audio = db.storage.from("weekly-podcasts").getPublicUrl(episode.audio_path).data.publicUrl;
        const included = (episode.report_ids ?? []).map(id => reportMap.get(id)).filter(Boolean);
        return <article key={episode.issue_key} style={{maxWidth:1000,margin:"24px auto",padding:"28px",border:"1px solid var(--line,#d9e1dd)",borderRadius:16,background:"var(--surface,#fff)"}}>
          <p className={styles.overline}>{episode.issue_key} · {episode.week_start}–{episode.week_end}</p>
          <h2>{episode.title}</h2>
          {episode.description ? <p>{episode.description}</p> : null}
          <audio controls preload="none" style={{width:"100%",margin:"18px 0"}}><source src={audio} type={episode.audio_mime_type} />브라우저에서 오디오를 재생할 수 없습니다.</audio>
          <h3>이번 호에 포함된 동향</h3>
          <ul>{included.map(report => <li key={report!.id}><Link href={`/public/trends/${report!.id}`}>{report!.title_ko}</Link>{report!.one_line_summary_ko ? <p>{report!.one_line_summary_ko}</p> : null}</li>)}</ul>
        </article>;
      }) : <div className={styles.weeklyEmpty}><strong>아직 공개된 팟캐스트가 없습니다</strong><p>주간호 오디오가 게시되면 이곳에서 들으실 수 있습니다.</p></div>}
    </section>
    <PublicFooter />
  </main>;
}
