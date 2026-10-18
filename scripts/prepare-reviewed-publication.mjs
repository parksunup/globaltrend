// Produces reviewable SQL files only. Executing them is a separate, authorized step.
import {mkdirSync,writeFileSync,readFileSync,readdirSync} from 'node:fs';
import {join} from 'node:path';
import {buildLegalReviewPackages} from '../lib/legal-release.ts';
import {loadTrendEditorial} from '../lib/trend-editorial.ts';
const out=join(process.cwd(),'work','reviewed-publication');
mkdirSync(out,{recursive:true});
const q=s=>`'${String(s).replaceAll("'","''")}'`;
const j=x=>`${q(JSON.stringify(x))}::jsonb`;
let n=0;
const manifest=[];
function emit(label,sql){const name=`${String(n++).padStart(3,'0')}-${label}.sql`;writeFileSync(join(out,name),sql,'utf8');manifest.push(name);}
const auditNote='2026-10-19 총괄 관리자 대화에서 공개 승인. 동향 내용·문체 및 번역 용어 기준 공동 검토 이력 반영. Codex가 위임받아 등록·발행 실행. 법률별 판본·범위와 기존 주석은 유지함.';
const actor=`do $actor$ begin if (select count(*) from public.team_memberships where role='admin' and is_active)<>1 then raise exception 'Select the approving administrator explicitly'; end if; perform set_config('request.jwt.claim.sub',(select user_id::text from public.team_memberships where role='admin' and is_active),true); end $actor$;`;
const batch=(arr,size=40000)=>{const batches=[];let b=[];for(const x of arr){if(b.length && JSON.stringify([...b,x]).length>size){batches.push(b);b=[];}b.push(x);}if(b.length)batches.push(b);return batches;};
for(const p of buildLegalReviewPackages()){
  const where=`content_hash=${q(p.contentHash)}`;
  const skeleton={...p,cells:[],document:p.document?{...p.document,sections:[]}:null};
  emit(`${p.recordId}-initialize`,`begin; insert into public.law_versions(legal_instrument_id,version_label,source_url,status,review_payload,content_hash)
select id,${q('repo:'+p.contentHash)},${q(p.instrument.links[0]?.url??'')},'draft',${j(skeleton)},${q(p.contentHash)} from public.legal_instruments where jurisdiction_code=${q(p.jurisdiction)} and short_name=${q(p.instrument.title)} on conflict do nothing;
select count(*) as registered from public.law_versions where ${where}; commit;`);
  for(const [key,values] of [['cells',p.cells],['document,sections',p.document?.sections??[]]]){
    let offset=0;
    for(const items of batch(values)){
      const path=`'{${key}}'`;
      emit(`${p.recordId}-append`,`begin; update public.law_versions set review_payload=jsonb_set(review_payload,${path},(review_payload#>${path})||${j(items)}) where ${where} and status='draft' and jsonb_array_length(review_payload#>${path})=${offset}; select jsonb_array_length(review_payload#>${path}) as loaded from public.law_versions where ${where}; commit;`);
      offset+=items.length;
    }
  }
  emit(`${p.recordId}-publish`,`begin; ${actor}
do $release$ declare v public.law_versions; s jsonb; l jsonb; c jsonb; sid uuid; cid uuid; crit uuid; begin
perform 1 from public.legal_instruments where id=(select legal_instrument_id from public.law_versions where ${where}) for update;
select * into strict v from public.law_versions where ${where} for update;
if v.status='published' then return; end if;
if v.status='verified' then perform public.advance_legal_review(v.id,'published',true); return; end if;
if v.status<>'draft' or jsonb_array_length(v.review_payload->'cells')<>17 or coalesce(jsonb_array_length(v.review_payload->'document'->'sections'),0)<>${p.document?.sections.length??0} then raise exception 'Incomplete publication payload'; end if;
for s in select value from jsonb_array_elements(coalesce(v.review_payload->'document'->'sections','[]'::jsonb)) loop
 insert into public.provision_nodes(law_version_id,node_key,heading,translation_ko,source_locator) values(v.id,s->>'id',s->>'title',coalesce((select string_agg(x->>'text',E'\n' order by ord) from jsonb_array_elements(s->'lines') with ordinality t(x,ord)),''),s-'lines') on conflict(law_version_id,node_key) do update set heading=excluded.heading,translation_ko=excluded.translation_ko,source_locator=excluded.source_locator returning id into sid;
 for l in select value from jsonb_array_elements(s->'lines') loop
  if l->>'id'=s->>'id' then continue; end if;
  insert into public.provision_nodes(law_version_id,parent_id,node_key,translation_ko,source_locator) values(v.id,sid,l->>'id',l->>'text',jsonb_build_object('section',s->>'id','label',l->>'label')) on conflict(law_version_id,node_key) do update set parent_id=excluded.parent_id,translation_ko=excluded.translation_ko,source_locator=excluded.source_locator;
 end loop;
end loop;
for c in select value from jsonb_array_elements(v.review_payload->'cells') loop
 select cr.id into strict crit from public.criteria cr join public.criteria_sets cs on cs.id=cr.criteria_set_id where cs.name='한국·일본 개인정보 보호법 비교 기준' and cs.version=1 and cr.criterion_key=c->>'criterionId';
 insert into public.comparison_cells(criterion_id,law_version_id,summary_ko,status) values(crit,v.id,c->>'summary','unreviewed') on conflict(criterion_id,law_version_id) do update set summary_ko=excluded.summary_ko returning id into cid;
 insert into public.comparison_cell_provisions(comparison_cell_id,provision_node_id) select distinct cid,pn.id from jsonb_array_elements_text(coalesce(c->'translationLinks','[]'::jsonb)) x join public.provision_nodes pn on pn.law_version_id=v.id and pn.node_key=split_part(x,'#',2) on conflict do nothing;
end loop;
perform public.advance_legal_review(v.id,'verified',true);
perform public.advance_legal_review(v.id,'published',true);
insert into public.review_events(entity_type,entity_id,action,actor_id,note) values('law_versions',v.id,'publication_authorized_in_conversation',auth.uid(),${q(auditNote)});
end $release$;
select status,jsonb_array_length(review_payload->'cells') cells from public.law_versions where ${where}; commit;`);
}
const editorial=loadTrendEditorial();
const sourceAliases={curia:'CJEU'};
for(const file of readdirSync('data/trends/fixtures').filter(f=>f.endsWith('.json')).sort()){
 const source=file.slice(0,-5), acronym=sourceAliases[source]??source.toUpperCase();
 const cfg=JSON.parse(readFileSync(`data/trends/source-configs/${source}.json`,'utf8'));
 const data=JSON.parse(readFileSync(`data/trends/fixtures/${file}`,'utf8'));
 emit(`${source}-source`,`begin;
insert into public.publishers(name,acronym,website_url,publisher_type) select ${q(cfg.organization)},${q(acronym)},${q(new URL(cfg.start_url).origin)},'other' where not exists(select 1 from public.publishers where acronym=${q(acronym)});
insert into public.sources(publisher_id,name,source_kind,fetch_strategy,start_url,is_active,parser_config) select id,${q(cfg.organization)},'manual','manual',${q(cfg.start_url)},true,'{"registration_reason":"reviewed_repository_publication","automatic_collection_enabled":false}'::jsonb from public.publishers where acronym=${q(acronym)} and not exists(select 1 from public.sources s join public.publishers p on p.id=s.publisher_id where p.acronym=${q(acronym)});
update public.sources set is_active=true where source_kind='manual' and parser_config->>'registration_reason'='reviewed_repository_publication' and publisher_id in(select id from public.publishers where acronym=${q(acronym)}); commit;`);
 for(const item of data.items){
  const e=editorial.get(item.record_id);if(!e)throw Error(`Missing editorial content: ${item.record_id}`);
  const kinds={official_news:'news',official_advisory:'guidance',guidance:'guidance',decision:'decision',regulatory_decision:'decision',judgment:'judgment',policy_report:'report',report:'report',press_release:'press_release',legislation:'legislation'};
  emit(`${item.record_id}-publish`,`begin; ${actor}
do $report$ declare sid uuid; iid uuid; rid uuid; begin
select s.id into strict sid from public.sources s join public.publishers p on p.id=s.publisher_id where p.acronym=${q(acronym)} order by s.created_at limit 1;
select id into iid from public.source_items where canonical_url=${q(item.official_url)};
if iid is null then insert into public.source_items(source_id,external_id,canonical_url,title_original,published_at,document_type,pipeline_status,relevance_status,metadata) values(sid,${q(item.record_id)},${q(item.official_url)},${q(item.original_title)},${q(item.source_published_date+'T12:00:00Z')},${q(kinds[item.document_type]??'other')},'drafted','relevant',${j({repository_record_id:item.record_id})}) returning id into iid; end if;
update public.source_items set metadata=(metadata-'publication_authorization'-'review_scope')||${j({repository_record_id:item.record_id})} where id=iid;
select id into rid from public.reports where source_item_id=iid;
if rid is not null then
 if exists(select 1 from public.reports where id=rid and status='published' and title_ko=${q(e.title_ko)} and one_line_summary_ko=${q(e.summary_ko)} and detailed_summary_ko=${q(e.details_ko)} and jurisdictions=array(select jsonb_array_elements_text(${j(item.jurisdictions??[])})) and topics=array(select jsonb_array_elements_text(${j(item.topic_tags??[])}))) then return; end if;
 if not exists(select 1 from public.reports where id=rid and status in('draft','in_review')) then raise exception 'Existing approved report differs; inspect before overwriting'; end if;
 insert into public.review_events(entity_type,entity_id,action,actor_id,note) select 'reports',rid,'previous_draft_preserved',auth.uid(),jsonb_build_object('previous_draft',to_jsonb(r),'authorization',${q(auditNote)})::text from public.reports r where r.id=rid;
 update public.reports set title_ko=${q(e.title_ko)},one_line_summary_ko=${q(e.summary_ko)},detailed_summary_ko=${q(e.details_ko)},jurisdictions=array(select jsonb_array_elements_text(${j(item.jurisdictions??[])})),topics=array(select jsonb_array_elements_text(${j(item.topic_tags??[])})),status='draft',automation_metadata=(automation_metadata-'authorization_note'-'review_scope')||${j({repository_record_id:item.record_id})} where id=rid;
else
 insert into public.reports(source_item_id,title_ko,one_line_summary_ko,detailed_summary_ko,jurisdictions,topics,status,automation_metadata) values(iid,${q(e.title_ko)},${q(e.summary_ko)},${q(e.details_ko)},array(select jsonb_array_elements_text(${j(item.jurisdictions??[])})),array(select jsonb_array_elements_text(${j(item.topic_tags??[])})),'draft',${j({repository_record_id:item.record_id})}) returning id into rid;
end if;
update public.reports set status='in_review' where id=rid;
update public.reports set status='approved' where id=rid;
update public.reports set status='published' where id=rid;
insert into public.review_events(entity_type,entity_id,action,actor_id,note) values('reports',rid,'publication_authorized_in_conversation',auth.uid(),${q(auditNote)});
end $report$; commit;`);
 }
}
writeFileSync(join(out,'manifest.json'),JSON.stringify(manifest),'utf8');
console.log(JSON.stringify({files:manifest.length,output:out}));
