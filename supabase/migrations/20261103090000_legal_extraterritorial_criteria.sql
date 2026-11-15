-- Source-only schema support for criterion v2. Existing v1 snapshots are retained.
-- This migration does not approve or publish any law, translation or comparison.
insert into public.criteria_sets(name,description,version,is_published)
values ('한국·일본 개인정보 보호법 비교 기준','7개 법제 비교: 기존 17개 기준에 역외 적용 추가',2,false);
insert into public.criteria(criteria_set_id,criterion_key,label_ko,description_ko,sort_order)
select target.id,c.criterion_key,c.label_ko,c.description_ko,c.sort_order
from public.criteria c join public.criteria_sets origin on origin.id=c.criteria_set_id
cross join public.criteria_sets target
where origin.name='한국·일본 개인정보 보호법 비교 기준' and origin.version=1
and target.name=origin.name and target.version=2;
insert into public.criteria(criteria_set_id,criterion_key,label_ko,description_ko,sort_order)
select id,'extraterritorial_scope','역외 적용','국외 사업자·국외 처리에 법이 적용되는 연결 요건. 국외이전 의무와 구별한다.',18
from public.criteria_sets where name='한국·일본 개인정보 보호법 비교 기준' and version=2;

-- Resolve an exact registered set, not merely a matching number of cells.
create function private.legal_criteria_set_for_payload(p jsonb) returns uuid
language plpgsql stable set search_path=pg_catalog,public,private as $$
declare target uuid;
begin
 if jsonb_typeof(p->'cells') is distinct from 'array' then
  raise invalid_parameter_value using message='Complete registered legal criteria are required'; end if;
 select cs.id into target from public.criteria_sets cs
 where cs.name='한국·일본 개인정보 보호법 비교 기준' and cs.version in (1,2)
 and (select count(*) from public.criteria cr where cr.criteria_set_id=cs.id)=jsonb_array_length(p->'cells')
 and (select count(distinct cr.id) from jsonb_array_elements(p->'cells') x
 join public.criteria cr on cr.criteria_set_id=cs.id and cr.criterion_key=x->>'criterionId')=jsonb_array_length(p->'cells')
 order by cs.version desc limit 1;
 if target is null then raise invalid_parameter_value using message='Complete registered legal criteria are required'; end if;
 return target;
end; $$;
revoke all on function private.legal_criteria_set_for_payload(jsonb) from public,anon,authenticated;

create or replace function private.import_legal_review(p jsonb) returns uuid
language plpgsql security definer set search_path=pg_catalog,public,private as $$
declare instrument_id uuid; version_id uuid; prior jsonb; criterion_set uuid; cell jsonb; criterion uuid;
 section jsonb; line jsonb; section_id uuid; node_id uuid; cell_id uuid;
begin
 if auth.uid() is null or not private.is_team_member('editor') then
   raise insufficient_privilege using message='Active editor is required'; end if;
 if jsonb_typeof(p) is distinct from 'object' or octet_length(p::text)>3000000
  or (p->>'contentHash') !~ '^[a-f0-9]{64}$' or p->>'contentHash' is null
  or nullif(p->>'recordId','') is null or nullif(p->>'versionLabel','') is null
  or p->>'jurisdiction' not in ('KR','JP','CN','EU','GB','US-CA','SG') or p->>'jurisdiction' is null
  or p->>'availability' not in ('translation','official_index','withheld','missing') or p->>'availability' is null
  or jsonb_typeof(p->'instrument') is distinct from 'object'
  or nullif(p->'instrument'->>'title','') is null
  or jsonb_typeof(p->'cells') is distinct from 'array' then
   raise invalid_parameter_value using message='Invalid legal review package'; end if;
 if exists(select 1 from jsonb_array_elements(p->'cells') c where c->>'jurisdiction' is distinct from p->>'jurisdiction' or jsonb_typeof(c->'summary') is distinct from 'string' or nullif(btrim(c->>'summary'),'') is null) then
   raise invalid_parameter_value using message='Matching legal jurisdictions are required'; end if;
 if p->'document' is distinct from 'null'::jsonb and (jsonb_typeof(p->'document') is distinct from 'object' or jsonb_typeof(p->'document'->'sections') is distinct from 'array') then
   raise invalid_parameter_value using message='Invalid legal document'; end if;
 criterion_set := private.legal_criteria_set_for_payload(p);
 select id into instrument_id from public.legal_instruments where jurisdiction_code=p->>'jurisdiction' and short_name=p->'instrument'->>'title';
 if instrument_id is null then raise invalid_parameter_value using message='Registered legal instrument is required'; end if;
 -- Serialize same-law imports and publication so an existing version is never replaced.
 perform 1 from public.legal_instruments where id=instrument_id for update;
 select id,review_payload into version_id,prior from public.law_versions where legal_instrument_id=instrument_id and content_hash=p->>'contentHash';
 if version_id is not null then
   if prior is distinct from p then raise invalid_parameter_value using message='Snapshot hash already belongs to different content'; end if;
   return version_id;
 end if;
 insert into public.law_versions(legal_instrument_id,version_label,source_url,status,review_payload,content_hash)
 values(instrument_id,'repo:'||(p->>'contentHash'),p->'instrument'->'links'->0->>'url','draft',p,p->>'contentHash') returning id into version_id;
 for section in select value from jsonb_array_elements(coalesce(p->'document'->'sections','[]'::jsonb)) loop
   insert into public.provision_nodes(law_version_id,node_key,heading,translation_ko,source_locator)
   values(version_id,section->>'id',section->>'title',coalesce((select string_agg(x->>'text',E'\n' order by ord) from jsonb_array_elements(section->'lines') with ordinality as t(x,ord)),''),section - 'lines') returning id into section_id;
   for line in select value from jsonb_array_elements(section->'lines') loop
     if line->>'id'=section->>'id' then continue; end if;
     insert into public.provision_nodes(law_version_id,parent_id,node_key,translation_ko,source_locator)
     values(version_id,section_id,line->>'id',line->>'text',jsonb_build_object('section',section->>'id','label',line->>'label'));
   end loop;
 end loop;
 for cell in select value from jsonb_array_elements(p->'cells') loop
   select id into criterion from public.criteria where criteria_set_id=criterion_set and criterion_key=cell->>'criterionId';
   insert into public.comparison_cells(criterion_id,law_version_id,summary_ko,status)
   values(criterion,version_id,cell->>'summary','unreviewed') returning id into cell_id;
   -- Only exact existing anchors may become relationships. No inferred or foreign-law substitution.
   insert into public.comparison_cell_provisions(comparison_cell_id,provision_node_id)
   select distinct cell_id,n.id from jsonb_array_elements_text(coalesce(cell->'translationLinks','[]'::jsonb)) l
   join public.provision_nodes n on n.law_version_id=version_id and n.node_key=split_part(l,'#',2)
   on conflict do nothing;
 end loop;
 insert into public.review_events(entity_type,entity_id,action,actor_id,note) values('law_versions',version_id,'imported',auth.uid(),p->>'contentHash');
 return version_id;
end; $$;
revoke all on function private.import_legal_review(jsonb) from public,anon;
grant execute on function private.import_legal_review(jsonb) to authenticated;


-- Reject empty comparison summaries and translated text before saving or publishing.
create or replace function private.validate_publication_payload(p_type text,p_payload jsonb,p_original jsonb) returns void
language plpgsql set search_path=pg_catalog,public,private as $$
declare criterion_set uuid;
begin
 if jsonb_typeof(p_payload) is distinct from 'object' or octet_length(p_payload::text)>6000000 then
  raise invalid_parameter_value using message='Invalid publication payload'; end if;
 if p_type='report' then
  if jsonb_typeof(p_payload->'title_ko') is distinct from 'string' or nullif(btrim(p_payload->>'title_ko'),'') is null
   or length(p_payload->>'title_ko')>500
   or jsonb_typeof(p_payload->'one_line_summary_ko') is distinct from 'string' or nullif(btrim(p_payload->>'one_line_summary_ko'),'') is null
   or length(p_payload->>'one_line_summary_ko')>3000
   or jsonb_typeof(p_payload->'detailed_summary_ko') is distinct from 'string' or nullif(btrim(p_payload->>'detailed_summary_ko'),'') is null
   or length(p_payload->>'detailed_summary_ko')>50000
   or jsonb_typeof(p_payload->'jurisdictions') is distinct from 'array' or jsonb_typeof(p_payload->'topics') is distinct from 'array' then
   raise invalid_parameter_value using message='Title, summary, body and classification are required'; end if;
  if exists(select 1 from jsonb_array_elements((p_payload->'jurisdictions')||(p_payload->'topics')) x where jsonb_typeof(x)<>'string')
   or (p_payload ? 'key_points' and jsonb_typeof(p_payload->'key_points')<>'array') then
   raise invalid_parameter_value using message='Invalid report classification'; end if;
 elsif p_type='law' then
  if p_payload->>'recordId' is distinct from p_original->>'recordId'
   or p_payload->>'jurisdiction' is distinct from p_original->>'jurisdiction'
   or p_payload->'instrument'->>'id' is distinct from p_original->'instrument'->>'id'
   or p_payload->'instrument'->>'title' is distinct from p_original->'instrument'->>'title'
   or p_payload->'document'->>'id' is distinct from p_original->'document'->>'id'
   or p_payload->>'contentHash' is null or p_payload->>'contentHash' !~ '^[a-f0-9]{64}$'
   or jsonb_typeof(p_payload->'cells') is distinct from 'array' then
   raise invalid_parameter_value using message='Legal package identity must remain unchanged'; end if;
  if exists(select 1 from jsonb_array_elements(p_payload->'cells') c
   where c->>'jurisdiction' is distinct from p_payload->>'jurisdiction' or jsonb_typeof(c->'summary') is distinct from 'string' or nullif(btrim(c->>'summary'),'') is null) then
   raise invalid_parameter_value using message='Matching legal criteria and nonempty summaries are required'; end if;
  criterion_set := private.legal_criteria_set_for_payload(p_payload);
  if p_payload->'document' is distinct from 'null'::jsonb then
   if jsonb_typeof(p_payload->'document'->'sections') is distinct from 'array' then
    raise invalid_parameter_value using message='Legal sections are required'; end if;
   if exists(select 1 from jsonb_array_elements(p_payload->'document'->'sections') s
    where nullif(s->>'id','') is null or jsonb_typeof(s->'lines') is distinct from 'array') then
    raise invalid_parameter_value using message='Invalid legal section'; end if;
   if exists(select 1 from jsonb_array_elements(p_payload->'document'->'sections') s,
    jsonb_array_elements(s->'lines') l where nullif(l->>'id','') is null or jsonb_typeof(l->'text') is distinct from 'string' or nullif(btrim(l->>'text'),'') is null) then
    raise invalid_parameter_value using message='Invalid legal text'; end if;
  end if;
 else raise invalid_parameter_value using message='Unknown publication entity type'; end if;
end; $$;

create or replace function private.materialize_legal_working_copy(p_id uuid,p jsonb) returns void
language plpgsql set search_path=pg_catalog,public,private as $$
declare s jsonb; l jsonb; c jsonb; sid uuid; cid uuid; crit uuid; criterion_set uuid;
begin
 criterion_set := private.legal_criteria_set_for_payload(p);
 -- Only the explicitly approved replacement is materialized; earlier versions stay intact.
 delete from public.comparison_cells cc using public.criteria cr
 where cc.law_version_id=p_id and cc.criterion_id=cr.id and cr.criteria_set_id<>criterion_set;
 update public.provision_nodes set translation_status='draft' where law_version_id=p_id;
 update public.comparison_cells set status='unreviewed' where law_version_id=p_id;
 for s in select value from jsonb_array_elements(coalesce(p->'document'->'sections','[]'::jsonb)) loop
  insert into public.provision_nodes(law_version_id,node_key,heading,translation_ko,source_locator)
   values(p_id,s->>'id',s->>'title',coalesce((select string_agg(x->>'text',E'\n' order by ord) from jsonb_array_elements(s->'lines') with ordinality t(x,ord)),''),s-'lines')
   on conflict(law_version_id,node_key) do update set heading=excluded.heading,translation_ko=excluded.translation_ko,source_locator=excluded.source_locator returning id into sid;
  for l in select value from jsonb_array_elements(s->'lines') loop
   if l->>'id'=s->>'id' then continue; end if;
   insert into public.provision_nodes(law_version_id,parent_id,node_key,translation_ko,source_locator)
    values(p_id,sid,l->>'id',l->>'text',jsonb_build_object('section',s->>'id','label',l->>'label'))
    on conflict(law_version_id,node_key) do update set parent_id=excluded.parent_id,translation_ko=excluded.translation_ko,source_locator=excluded.source_locator;
  end loop;
 end loop;
 for c in select value from jsonb_array_elements(p->'cells') loop
  select cr.id into strict crit from public.criteria cr join public.criteria_sets cs on cs.id=cr.criteria_set_id
   where cs.id=criterion_set and cr.criterion_key=c->>'criterionId';
  insert into public.comparison_cells(criterion_id,law_version_id,summary_ko,status) values(crit,p_id,c->>'summary','unreviewed')
   on conflict(criterion_id,law_version_id) do update set summary_ko=excluded.summary_ko returning id into cid;
  delete from public.comparison_cell_provisions where comparison_cell_id=cid;
  insert into public.comparison_cell_provisions(comparison_cell_id,provision_node_id)
   select distinct cid,pn.id from jsonb_array_elements_text(coalesce(c->'translationLinks','[]'::jsonb)) x
   join public.provision_nodes pn on pn.law_version_id=p_id and pn.node_key=split_part(x,'#',2) on conflict do nothing;
 end loop;
end; $$;
revoke all on function private.materialize_legal_working_copy(uuid,jsonb) from public,anon,authenticated;
