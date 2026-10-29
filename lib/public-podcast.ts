import type {SupabaseClient} from '@supabase/supabase-js';
export type PublicPodcast={issueKey:string;title:string;description:string;start:string;end:string;audioUrl:string;mime:string};
export async function loadLatestPublicPodcast(db:Pick<SupabaseClient,'from'|'storage'>):Promise<{podcast:PublicPodcast|null;unavailable:boolean}>{
 const {data:episodes,error}=await db.from('weekly_podcast_episodes').select('issue_key,audio_path,audio_mime_type,published_at,status').eq('status','published').order('published_at',{ascending:false}).limit(8);
 if(error)return {podcast:null,unavailable:true};
 const publicEpisodes=(episodes??[]).filter(e=>e.status==='published').sort((a,b)=>String(b.published_at).localeCompare(String(a.published_at)));
 if(!publicEpisodes.length)return {podcast:null,unavailable:false};
 const {data:issues,error:issueError}=await db.from('weekly_issues').select('issue_key,title,description,week_start,week_end,status').in('issue_key',publicEpisodes.map(e=>e.issue_key)).eq('status','published');
 if(issueError)return {podcast:null,unavailable:true};
 for(const episode of publicEpisodes){
  const issue=issues?.find(i=>i.issue_key===episode.issue_key&&i.status==='published');if(!issue)continue;
  const {data,error:audioError}=await db.storage.from('weekly-podcasts').createSignedUrl(episode.audio_path,3600);
  if(audioError||!data?.signedUrl)return {podcast:null,unavailable:true};
  return {podcast:{issueKey:episode.issue_key,title:issue.title,description:issue.description,start:issue.week_start,end:issue.week_end,audioUrl:data.signedUrl,mime:episode.audio_mime_type},unavailable:false};
 }
 return {podcast:null,unavailable:false};
}
