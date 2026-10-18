import {createClient} from './supabase/server';
import {loadPublicLegal} from './public-legal';
import {loadPublishedStories} from './published-trends';
import {isDeepStrictEqual} from 'node:util';
import type {LegalReviewPackage} from './legal-release';
import type {WorkspaceItem} from './workspace-model';

export async function workspaceSession() {
 const db=await createClient();const {data:{user}}=await db.auth.getUser();
 const {data:member}=user?await db.from('team_memberships').select('role,is_active').eq('user_id',user.id).maybeSingle():{data:null};
 const role=member?.is_active?String(member.role):null;
 return {db,user,role,canEdit:role==='admin'||role==='editor',canPublish:role==='admin'};
}
export function reportPayload(row:Record<string,unknown>) {
 return {title_ko:row.title_ko??'',one_line_summary_ko:row.one_line_summary_ko??'',detailed_summary_ko:row.detailed_summary_ko??'',jurisdictions:row.jurisdictions??[],topics:row.topics??[]};
}
export function reportChanged(a:Record<string,unknown>,b:Record<string,unknown>) {return !isDeepStrictEqual(reportPayload(a),reportPayload(b));}
function textChanges(before:Record<string,unknown>,after:Record<string,unknown>,labels:Record<string,string>) {return Object.entries(labels).flatMap(([key,label])=>isDeepStrictEqual(before[key],after[key])?[]:[{label,before:Array.isArray(before[key])?(before[key] as string[]).join(', '):String(before[key]??''),after:Array.isArray(after[key])?(after[key] as string[]).join(', '):String(after[key]??'')}]);}
function legalChanges(before:LegalReviewPackage,after:LegalReviewPackage) {const prior=new Map(before.document?.sections.flatMap(s=>s.lines.map(l=>[l.id,l.text] as const))??[]);const changes=textChanges({summary:before.instrument.summary,scopeNote:before.document?.scopeNote},{summary:after.instrument.summary,scopeNote:after.document?.scopeNote},{summary:'자료 설명',scopeNote:'번역 범위'});for(const s of after.document?.sections??[])for(const l of s.lines)if(prior.get(l.id)!==l.text)changes.push({label:s.title+(l.label?' · '+l.label:''),before:prior.get(l.id)??'',after:l.text});for(const c of after.cells){const old=before.cells.find(x=>x.id===c.id);if(old)changes.push(...textChanges(old as unknown as Record<string,unknown>,c as unknown as Record<string,unknown>,{summary:c.criterionName+' 요약',exceptions:c.criterionName+' 예외',articleNumbers:c.criterionName+' 관련 조항'}));}return changes;}
const strings=(v:unknown):string[]=>Array.isArray(v)?v.filter((s):s is string=>typeof s==='string'):[];

/** Preview may show public records, never private working copies of another session. */
export async function previewWorkspaceItems():Promise<WorkspaceItem[]> {
 const [stories,legal]=await Promise.all([loadPublishedStories(),loadPublicLegal()]);
 return [...stories.map(s=>({id:s.id,kind:'trend' as const,revision:'1',title:s.title,subtitle:s.institution,summary:s.summary,body:s.details,jurisdictions:s.jurisdictions??[],topics:s.tags,status:'published' as const,publishedHref:'/public/trends/'+s.id,sourceHref:s.officialUrl})),
 ...legal.instruments.map(i=>({id:i.id,kind:'law' as const,revision:'1',title:i.title,summary:`${legal.documents.find(d=>i.id.endsWith(d.id))?.articleCount??'공식 원문 색인'}${legal.documents.some(d=>i.id.endsWith(d.id))?'개 조문 · 한국어 전문 포함':' · 본문은 공식 사이트 열람'} · 비교 기준 ${legal.cells.filter(c=>i.fields.some(f=>f.label==='관할권'&&f.value===c.jurisdiction)).length}개`,jurisdictions:i.fields.filter(f=>f.label==='관할권').map(f=>f.value),status:'published' as const,publishedHref:legal.documents.find(d=>i.id.endsWith(d.id))?'/public/laws/'+legal.documents.find(d=>i.id.endsWith(d.id))!.id:'/public/laws',sourceHref:i.links[0]?.url}))];
}

export async function loadWorkspaceItems(session:Awaited<ReturnType<typeof workspaceSession>>) {
 if(!session.canEdit)return {items:[] as WorkspaceItem[],error:null};
 const {db}=session;
 // Read all pages so a growing collection is not silently truncated at the API limit.
 async function all(table:string,columns:string) {
  const rows:Record<string,unknown>[]=[];
  for(let offset=0;;offset+=500){const result=await db.from(table).select(columns).order(table==='publication_working_copies'?'entity_id':'id').range(offset,offset+499);if(result.error)throw result.error;rows.push(...(result.data??[]) as unknown as Record<string,unknown>[]);if((result.data??[]).length<500)break;}
  return rows;
 }
 try {
 const [reports,laws,copies,sources]=await Promise.all([
  all('reports','id,source_item_id,title_ko,one_line_summary_ko,detailed_summary_ko,jurisdictions,topics,status,updated_at'),
  all('law_versions','id,legal_instrument_id,status,review_payload,content_hash'),
  all('publication_working_copies','entity_type,entity_id,revision,payload,trashed_at,updated_at,requested_at'),
  all('source_items','id,title_original,canonical_url')]);
 const originals=new Map(sources.map(s=>[s.id,s]));
 const working=new Map(copies.map(c=>[c.entity_type+':'+c.entity_id,c]));
 const items:WorkspaceItem[]=[];
 for(const r of reports){const w=working.get('report:'+r.id);if(!w)throw new Error('missing_working_copy');
  const p=w.payload as Record<string,unknown>,original=originals.get(r.source_item_id);const current=reportPayload(p),changed=reportChanged(p,r);
  const issues=[];if(!String(current.title_ko).trim())issues.push({message:'제목을 입력해 주세요.',blocking:true});if(!String(current.one_line_summary_ko).trim())issues.push({message:'요약을 입력해 주세요.',blocking:true});if(!String(current.detailed_summary_ko).trim())issues.push({message:'본문을 입력해 주세요.',blocking:true});if(!original?.canonical_url)issues.push({message:'공식 원문 주소를 확인해 주세요.',blocking:true});
  items.push({id:String(r.id),kind:'trend',revision:String(w.revision),title:String(current.title_ko),summary:String(current.one_line_summary_ko),body:String(current.detailed_summary_ko),jurisdictions:strings(current.jurisdictions),topics:strings(current.topics),status:w.trashed_at?'trashed':r.status==='published'?'published':issues.length?'needs_changes':'ready',hasUnpublishedChanges:r.status==='published'&&changed,changes:r.status==='published'?textChanges(reportPayload(r),current,{title_ko:'한국어 제목',one_line_summary_ko:'핵심 요약',detailed_summary_ko:'상세 내용',jurisdictions:'국가·지역',topics:'주제'}):[],issues,updatedAt:String(w.updated_at),sourceHref:String(original?.canonical_url??''),sourceTitle:String(original?.title_original??''),publishedHref:r.status==='published'?'/public/trends/'+r.id:undefined,internalRecords:[{label:'공개 요청',value:w.requested_at?'관리자에게 요청됨':'요청 전'}]});
 }
 for(const r of laws){if(!r.review_payload||r.status==='superseded')continue;const w=working.get('law:'+r.id);if(!w)throw new Error('missing_working_copy');const p=w.payload as LegalReviewPackage,live=r.review_payload as LegalReviewPackage;const issues=[];
  if(p.cells.length!==17)issues.push({message:'17개 비교 기준을 모두 확인해 주세요.',blocking:true});
  if(!p.document&&p.availability!=='official_index')issues.push({message:'번역 전문이 없는 자료입니다. 비교표만 공개됩니다.',blocking:false});
  items.push({id:String(r.id),kind:'law',publicationGroup:String(r.legal_instrument_id),revision:String(w.revision),title:p.instrument.title,subtitle:p.document?'한국어 전문·비교표':'공식 원문 색인·비교표',summary:`${p.document?`한국어 전문 ${p.document.articleCount}개 조문`:'한국어 공식 원문 별도 열람'} · 비교 기준 ${p.cells.length}개`,jurisdictions:[p.jurisdiction],status:w.trashed_at?'trashed':r.status==='published'?'published':issues.some(i=>i.blocking)?'needs_changes':'ready',hasUnpublishedChanges:r.status==='published'&&!isDeepStrictEqual(p,live),changes:r.status==='published'?legalChanges(live,p):[],issues,updatedAt:String(w.updated_at),sourceHref:p.instrument.links[0]?.url,publishedHref:r.status==='published'?(p.document?'/public/laws/'+p.document.id:'/public/laws'):undefined,editorHref:'/work/legal/'+r.id+'/edit',internalRecords:[{label:'작성 당시 판본 설명',value:p.instrument.summary},{label:'판본 기록',value:p.versionLabel},{label:'구성',value:`비교 기준 ${p.cells.length}개 · ${p.document?'한국어 전문 포함':'공식 원문 별도 열람'}`},{label:'공개 요청',value:w.requested_at?'관리자에게 요청됨':'요청 전'}]});
 }
 return {items:items.sort((a,b)=>(b.updatedAt??'').localeCompare(a.updatedAt??'')),error:null};
 } catch(error){console.error('Workspace load failed',error);return {items:[] as WorkspaceItem[],error:'자료를 불러오지 못했습니다. 새로고침 후에도 같으면 작업 공간 준비 상태를 확인해 주세요.'};}
}
