import Link from "next/link";
import { createClient } from "../../../../lib/supabase/server";
import { PublicHeader, PublicFooter } from "../../public-navigation";
import styles from "../../public.module.css";
import podcastStyles from './podcast.module.css';
import WeeklyFormats from '../weekly-formats';
import WeeklyIssuePicker from '../weekly-issue-picker';
import {podcastDisplayTitle} from '../../../../lib/public-podcast';
import {readAllPages} from '../../../../lib/read-all-pages';

export const dynamic = "force-dynamic";

type Episode={issue_key:string;audio_path:string;audio_mime_type:string;published_at:string|null};
type Issue={issue_key:string;title:string;description:string;week_start:string;week_end:string};

export default async function PublishedPodcastsPage({searchParams}:{searchParams:Promise<{issue?:string}>}) {
  const db = await createClient();
  let episodes:Episode[]=[],issues:Issue[]=[],listError=false,schemaNotReady=false;
  try {
    episodes=await readAllPages(async(offset,count)=>{
      const {data,error}=await db.from('weekly_podcast_episodes')
        .select('issue_key,audio_path,audio_mime_type,published_at')
        .eq('status','published').order('published_at',{ascending:false}).order('issue_key').range(offset,offset+count-1);
      if(error)throw error;
      return data??[];
    });
    if(episodes.length)issues=await readAllPages(async(offset,count)=>{
      const {data,error}=await db.from('weekly_issues')
        .select('issue_key,title,description,week_start,week_end')
        .eq('status','published').order('week_start',{ascending:false}).order('issue_key').range(offset,offset+count-1);
      if(error)throw error;
      return data??[];
    });
  }catch(error){
    console.error('Podcast archive unavailable:',error);
    listError=true;
    schemaNotReady=typeof error==='object'&&error!==null&&'code' in error&&['PGRST205','42P01'].includes(String(error.code));
  }
  const issueMap=new Map(issues.map(issue=>[issue.issue_key,issue]));
  const available=episodes.filter(episode=>issueMap.has(episode.issue_key));
  const requested=(await searchParams).issue;
  const selected=available.find(episode=>episode.issue_key===requested)??available[0];
  const selectedIssue=selected?issueMap.get(selected.issue_key):undefined;
  const {data:links,error:linksError}=selected?await db.from('weekly_issue_reports')
    .select('issue_key,report_id,sort_order').eq('issue_key',selected.issue_key).order('sort_order'):{data:[],error:null};
  const reportIds=[...new Set((links??[]).map(link=>link.report_id))];
  const {data:reports,error:reportsError}=reportIds.length?await db.from('reports')
    .select('id,title_ko,one_line_summary_ko').eq('status','published').in('id',reportIds):{data:[],error:null};
  const reportMap=new Map((reports??[]).map(report=>[report.id,report]));
  const {data:audio,error:audioError}=selected?await db.storage.from('weekly-podcasts')
    .createSignedUrl(selected.audio_path,3600):{data:null,error:null};
  const options=available.map(episode=>{
    const issue=issueMap.get(episode.issue_key)!;
    return {...issue,title:podcastDisplayTitle(issue.title)};
  });

  return <main className={styles.site}>
    <PublicHeader active="/public/weekly" />
    <section className={styles.searchPage}>
      <div className={styles.searchIntro}><p className={styles.overline}>WEEKLY PODCAST</p><h1>주간 동향</h1><p>한 주의 동향을 읽고, 주요 주제를 깊이 다루는 팟캐스트도 들어보세요.</p></div>
      <WeeklyFormats active="podcast" />
      <h2>주간 동향 팟캐스트</h2><p>주요 주제 한 가지를 깊이 살펴보고, 짧은 추가 소식을 두 진행자의 대화로 들어보세요.</p>
      {!listError&&<WeeklyIssuePicker issues={options} selectedKey={selected?.issue_key??''} basePath="/public/weekly/podcast" label="공개된 팟캐스트 호 선택"/>}
      {listError ? schemaNotReady
        ? <div className={styles.weeklyEmpty}><strong>팟캐스트 공개를 준비하고 있습니다</strong><p>게시 기능을 배포한 뒤 팟캐스트를 들으실 수 있습니다.</p></div>
        : <p role="alert">팟캐스트 목록을 불러오지 못했습니다. 잠시 후 다시 이용해 주세요.</p>
        : selected&&selectedIssue ? <article key={selected.issue_key} className={podcastStyles.card}>
          <p className={styles.overline}>{selected.issue_key} · {selectedIssue.week_start}–{selectedIssue.week_end}</p>
          <h2>{podcastDisplayTitle(selectedIssue.title)}</h2>
          {selectedIssue.description ? <p>{selectedIssue.description}</p> : null}
          {audio?.signedUrl&&!audioError ? <audio controls preload="none" className={podcastStyles.audio}><source src={audio.signedUrl} type={selected.audio_mime_type} />브라우저에서 오디오를 재생할 수 없습니다.</audio> : <p role="alert">오디오를 불러오지 못했습니다. 잠시 후 새로고침해 주세요.</p>}
          <h3>이번 호에 포함된 동향</h3>
          {linksError||reportsError ? <p role="alert">포함된 동향 목록을 불러오지 못했습니다.</p> :
            <ul>{(links??[]).map(link=>reportMap.get(link.report_id)).filter((report):report is NonNullable<typeof report>=>Boolean(report)).map(report=><li key={report.id}><Link href={`/public/trends/${report.id}`}>{report.title_ko}</Link>{report.one_line_summary_ko ? <p>{report.one_line_summary_ko}</p> : null}</li>)}</ul>}
        </article> : <div className={styles.weeklyEmpty}><strong>아직 공개된 팟캐스트가 없습니다</strong><p>새 오디오가 게시되면 이곳에서 들으실 수 있습니다.</p></div>}
    </section>
    <PublicFooter />
  </main>;
}
