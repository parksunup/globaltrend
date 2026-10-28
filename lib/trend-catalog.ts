import {createClient} from '@supabase/supabase-js';
import type {PublishedStory} from './published-trends';
export async function loadTrendCatalog(itemId?:string, readPage?:(offset:number)=>Promise<{data:any[]|null;error:{code:string}|null}>):Promise<PublishedStory[]> {
 const db=readPage?null:createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,{auth:{persistSession:false}});
 const stories:PublishedStory[]=[];
 for(let offset=0;;offset+=200){
  const {data,error}=readPage?await readPage(offset):await db!.rpc('get_trend_catalog',{p_offset:offset,p_limit:200,p_item_id:itemId??null});
  if(error)throw Error(`수집 자료 조회 실패: ${error.code}`);
  for(const row of data??[]){if(row.editorial_status!=='published'||!row.report_id)throw Error('공개 승인되지 않은 자료 응답입니다.');stories.push({id:row.report_id,publicationStatus:'published',country:row.jurisdictions?.[0]??'기타',jurisdictions:row.jurisdictions,region:row.source_name,institution:row.source_name,title:row.title,originalTitle:row.original_title,summary:'한국어 보고서 발행 완료',details:'',kind:row.document_type,tags:row.topics??[],date:row.published_date?.replaceAll('-','.')??'날짜 확인 중',officialUrl:row.official_url});}
  if(itemId||(data??[]).length<200)break;
 }
 return stories;
}
