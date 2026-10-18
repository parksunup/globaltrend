-- Immutable per-law review snapshots extend the existing law/criteria model.
alter table public.law_versions add column review_payload jsonb;
alter table public.law_versions add column content_hash text;
alter table public.law_versions add column reviewed_by uuid references public.profiles(id);
alter table public.law_versions add column reviewed_at timestamptz;
create unique index law_versions_content_hash_idx on public.law_versions(legal_instrument_id,content_hash) where content_hash is not null;

-- All changes to reviewed content go through guarded functions, including direct API calls.
revoke insert,update,delete on public.law_versions,public.provision_nodes,
 public.comparison_cells,public.comparison_cell_provisions from authenticated;
-- Parent DELETE also cascades into protected review snapshots/relationships.
revoke delete on public.legal_instruments,public.criteria_sets,public.criteria from authenticated;

create function private.import_legal_review(p jsonb) returns uuid
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
 if jsonb_array_length(p->'cells')<>17 or exists(select 1 from jsonb_array_elements(p->'cells') c where c->>'jurisdiction' is distinct from p->>'jurisdiction') then
   raise invalid_parameter_value using message='Exactly 17 matching criteria are required'; end if;
 if p->'document' is distinct from 'null'::jsonb and (jsonb_typeof(p->'document') is distinct from 'object' or jsonb_typeof(p->'document'->'sections') is distinct from 'array') then
   raise invalid_parameter_value using message='Invalid legal document'; end if;
 select id into criterion_set from public.criteria_sets where name='한국·일본 개인정보 보호법 비교 기준' and version=1;
 if (select count(distinct c.id) from jsonb_array_elements(p->'cells') x join public.criteria c on c.criterion_key=x->>'criterionId' and c.criteria_set_id=criterion_set)<>17 then
   raise invalid_parameter_value using message='Exactly 17 matching criteria are required'; end if;
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

create function public.import_legal_review(p_payload jsonb) returns uuid
language sql security invoker set search_path=pg_catalog,private as $$ select private.import_legal_review(p_payload); $$;
revoke all on function public.import_legal_review(jsonb) from public,anon;
grant execute on function public.import_legal_review(jsonb) to authenticated;

create function private.advance_legal_review(p_id uuid,p_next text,p_checked boolean) returns uuid
language plpgsql security definer set search_path=pg_catalog,public,private as $$
declare v public.law_versions; target_instrument uuid;
begin
 if auth.uid() is null or not private.is_team_member('admin') then raise insufficient_privilege using message='Active administrator is required'; end if;
 if p_checked is distinct from true then raise invalid_parameter_value using message='Source, content and reuse review confirmation is required'; end if;
 select legal_instrument_id into target_instrument from public.law_versions where id=p_id;
 perform 1 from public.legal_instruments where id=target_instrument for update;
 select * into v from public.law_versions where id=p_id for update;
 if not found or v.review_payload is null or p_next is null or p_next not in ('verified','published')
   or (p_next='verified' and v.status<>'draft') or (p_next='published' and v.status<>'verified') then
   raise invalid_parameter_value using message='Invalid legal review transition'; end if;
 if p_next='published' then
   update public.law_versions set status='superseded' where legal_instrument_id=v.legal_instrument_id and status='published';
   update public.provision_nodes set translation_status='draft' where law_version_id in (select id from public.law_versions where legal_instrument_id=v.legal_instrument_id and status='superseded');
   update public.comparison_cells set status='unreviewed' where law_version_id in (select id from public.law_versions where legal_instrument_id=v.legal_instrument_id and status='superseded');
   update public.legal_instruments set is_published=true where id=v.legal_instrument_id;
   update public.criteria_sets set is_published=true where id in (select c.criteria_set_id from public.criteria c join public.comparison_cells cc on cc.criterion_id=c.id where cc.law_version_id=p_id);
 end if;
 update public.law_versions set status=p_next,reviewed_by=auth.uid(),reviewed_at=now() where id=p_id;
 update public.provision_nodes set translation_status=case when p_next='published' then 'published' else 'approved' end where law_version_id=p_id;
 update public.comparison_cells set status=case when p_next='published' then 'published' else 'approved' end,reviewed_by=auth.uid(),reviewed_at=now() where law_version_id=p_id;
 insert into public.review_events(entity_type,entity_id,action,actor_id,note) values('law_versions',p_id,p_next,auth.uid(),v.content_hash);
 return p_id;
end; $$;
revoke all on function private.advance_legal_review(uuid,text,boolean) from public,anon;
grant execute on function private.advance_legal_review(uuid,text,boolean) to authenticated;
create function public.advance_legal_review(p_id uuid,p_next text,p_checked boolean) returns uuid
language sql security invoker set search_path=pg_catalog,private as $$ select private.advance_legal_review(p_id,p_next,p_checked); $$;
revoke all on function public.advance_legal_review(uuid,text,boolean) from public,anon;
grant execute on function public.advance_legal_review(uuid,text,boolean) to authenticated;

-- Public comparison data must belong to the currently published version too.
drop policy comparison_cells_public_select on public.comparison_cells;
create policy comparison_cells_public_select on public.comparison_cells for select to anon,authenticated
 using(status='published' and exists(select 1 from public.law_versions v where v.id=law_version_id and v.status='published'));
