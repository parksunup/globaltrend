import Link from "next/link";
import { createClient } from "../../../../lib/supabase/server";
import { PublicHeader, PublicFooter } from "../../public-navigation";
import styles from "../../public.module.css";
import WeeklyFormats from '../weekly-formats';

export const dynamic = "force-dynamic";

export default async function PublishedPodcastsPage() {
  const db = await createClient();
  const { data: episodes, error } = await db.from("weekly_podcast_episodes")
    .select("issue_key,audio_path,audio_mime_type,published_at")
    .eq("status", "published").order("published_at", { ascending: false }).limit(52);
  const episodeRows = episodes ?? [];
  const issueKeys = episodeRows.map(episode => episode.issue_key);
  const [{ data: issues }, { data: links, error: linksError }] = issueKeys.length
    ? await Promise.all([
        db.from("weekly_issues").select("issue_key,title,description,week_start,week_end").in("issue_key", issueKeys),
        db.from("weekly_issue_reports").select("issue_key,report_id,sort_order").in("issue_key", issueKeys).order("sort_order"),
      ])
    : [{ data: [] }, { data: [], error: null }];
  const reportIds = [...new Set((links ?? []).map(link => link.report_id))];
  const { data: reports } = reportIds.length
    ? await db.from("reports").select("id,title_ko,one_line_summary_ko")
        .eq("status", "published").in("id", reportIds)
    : { data: [] };
  const issueMap = new Map((issues ?? []).map(issue => [issue.issue_key, issue]));
  const reportMap = new Map((reports ?? []).map(report => [report.id, report]));
  const linksByIssue = new Map<string, typeof links>();
  for (const link of links ?? []) {
    const rows = linksByIssue.get(link.issue_key) ?? [];
    rows.push(link);
    linksByIssue.set(link.issue_key, rows);
  }
  const signedAudios = await Promise.all(episodeRows.map(async episode => {
    const { data } = await db.storage.from("weekly-podcasts").createSignedUrl(episode.audio_path, 60 * 60);
    return [episode.issue_key, data?.signedUrl ?? null] as const;
  }));
  const audioMap = new Map(signedAudios);

  const schemaNotReady = error?.code === "PGRST205" || error?.code === "42P01";

  return <main className={styles.site}>
    <PublicHeader active="/public/weekly" />
    <section className={styles.searchPage}>
      <div className={styles.searchIntro}><p className={styles.overline}>WEEKLY PODCAST</p><h1>주간호</h1><p>한 주의 동향을 읽고, 주요 주제를 깊이 다루는 팟캐스트도 들어보세요.</p></div>
      <WeeklyFormats active="podcast" />
      <h2>주간 동향 팟캐스트</h2><p>주요 주제 한 가지를 깊이 살펴보고, 짧은 추가 소식을 두 진행자의 대화로 들어보세요.</p>
      {error ? schemaNotReady
        ? <div className={styles.weeklyEmpty}><strong>팟캐스트 공개를 준비하고 있습니다</strong><p>게시 기능을 배포한 뒤 주간호 오디오가 공개됩니다.</p></div>
        : <p role="alert">팟캐스트 목록을 불러오지 못했습니다. 잠시 후 다시 이용해 주세요.</p>
        : episodeRows.length ? episodeRows.map(episode => {
        const issue = issueMap.get(episode.issue_key);
        const included = (linksByIssue.get(episode.issue_key) ?? [])
          .map(link => reportMap.get(link.report_id)).filter(Boolean);
        const audio = audioMap.get(episode.issue_key);
        return <article key={episode.issue_key} style={{maxWidth:1000,margin:"24px auto",padding:"28px",border:"1px solid var(--line,#d9e1dd)",borderRadius:16,background:"var(--surface,#fff)"}}>
          <p className={styles.overline}>{episode.issue_key} · {issue?.week_start}–{issue?.week_end}</p>
          <h2>{issue?.title ?? episode.issue_key}</h2>
          {issue?.description ? <p>{issue.description}</p> : null}
          {audio ? <audio controls preload="none" style={{width:"100%",margin:"18px 0"}}><source src={audio} type={episode.audio_mime_type} />브라우저에서 오디오를 재생할 수 없습니다.</audio> : <p role="alert">오디오를 불러오지 못했습니다. 잠시 후 새로고침해 주세요.</p>}
          <h3>이번 호에 포함된 동향</h3>
          {linksError ? <p role="alert">포함된 동향 목록을 불러오지 못했습니다.</p> :
            <ul>{included.map(report => report ? <li key={report.id}><Link href={`/public/trends/${report.id}`}>{report.title_ko}</Link>{report.one_line_summary_ko ? <p>{report.one_line_summary_ko}</p> : null}</li> : null)}</ul>}
        </article>;
      }) : <div className={styles.weeklyEmpty}><strong>아직 공개된 팟캐스트가 없습니다</strong><p>주간호 오디오가 게시되면 이곳에서 들으실 수 있습니다.</p></div>}
    </section>
    <PublicFooter />
  </main>;
}
