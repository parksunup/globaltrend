-- The live tables remain the public read model. Edits are saved separately until
-- an administrator atomically publishes that exact working-copy revision.
create table public.publication_working_copies (
 entity_type text not null check(entity_type in ('report','law')),
 entity_id uuid not null,
 revision bigint not null default 1 check(revision > 0),
 payload jsonb not null check(jsonb_typeof(payload)='object'),
 published_revision bigint,
 trashed_at timestamptz,
 requested_at timestamptz,
 updated_at timestamptz not null default now(),
 last_action text,
 last_action_revision bigint,
 primary key(entity_type,entity_id)
);
alter table public.publication_working_copies enable row level security;
revoke all on public.publication_working_copies from public,anon,authenticated;
grant select on public.publication_working_copies to authenticated;
create policy publication_working_copies_team_read on public.publication_working_copies
 for select to authenticated using((select private.is_team_member('reviewer')));

create function private.report_publication_payload(r public.reports) returns jsonb
language sql immutable set search_path=pg_catalog as $$
 select jsonb_build_object('title_ko',r.title_ko,'one_line_summary_ko',r.one_line_summary_ko,
 'detailed_summary_ko',r.detailed_summary_ko,'jurisdictions',to_jsonb(r.jurisdictions),
 'topics',to_jsonb(r.topics),'key_points',r.key_points,'policy_implications_ko',r.policy_implications_ko);
$$;
revoke all on function private.report_publication_payload(public.reports) from public,anon,authenticated;

insert into public.publication_working_copies(entity_type,entity_id,payload,published_revision)
 select 'report',r.id,private.report_publication_payload(r),case when r.status='published' then 1 end from public.reports r;
insert into public.publication_working_copies(entity_type,entity_id,payload,published_revision)
 select 'law',v.id,v.review_payload,case when v.status='published' then 1 end from public.law_versions v where v.review_payload is not null;

-- New records from existing draft/import RPCs become editable immediately.
create function private.seed_publication_working_copy() returns trigger
language plpgsql security definer set search_path=pg_catalog,public,private as $$
declare next_payload jsonb; previous_payload jsonb; kind text;
begin
 if tg_table_name='reports' then
  next_payload:=private.report_publication_payload(new); kind:='report';
  if tg_op='UPDATE' then previous_payload:=private.report_publication_payload(old); end if;
  insert into public.publication_working_copies(entity_type,entity_id,payload,published_revision)
   values('report',new.id,private.report_publication_payload(new),case when new.status='published' then 1 end) on conflict do nothing;
 elsif new.review_payload is not null then
  next_payload:=new.review_payload; kind:='law';
  if tg_op='UPDATE' then previous_payload:=old.review_payload; end if;
  insert into public.publication_working_copies(entity_type,entity_id,payload,published_revision)
   values('law',new.id,new.review_payload,case when new.status='published' then 1 end) on conflict do nothing;
 end if;
 if tg_op='UPDATE' and next_payload is distinct from previous_payload then
  update public.publication_working_copies set payload=next_payload,revision=revision+1,updated_at=now()
   where entity_type=kind and entity_id=new.id and last_action is null and payload=previous_payload;
 end if;
 return new;
end; $$;
revoke all on function private.seed_publication_working_copy() from public,anon,authenticated;
create trigger seed_report_working_copy after insert or update of title_ko,one_line_summary_ko,detailed_summary_ko,jurisdictions,topics,key_points,policy_implications_ko on public.reports for each row execute function private.seed_publication_working_copy();
create trigger seed_law_working_copy after insert or update of review_payload on public.law_versions for each row execute function private.seed_publication_working_copy();

create function private.validate_publication_payload(p_type text,p_payload jsonb,p_original jsonb) returns void
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
  if jsonb_array_length(p_payload->'cells')<>17 or exists(select 1 from jsonb_array_elements(p_payload->'cells') c
   where c->>'jurisdiction' is distinct from p_payload->>'jurisdiction' or jsonb_typeof(c->'summary') is distinct from 'string') then
   raise invalid_parameter_value using message='Exactly 17 matching legal criteria are required'; end if;
  select id into criterion_set from public.criteria_sets where name='한국·일본 개인정보 보호법 비교 기준' and version=1;
  if (select count(distinct cr.id) from jsonb_array_elements(p_payload->'cells') c join public.criteria cr
   on cr.criterion_key=c->>'criterionId' and cr.criteria_set_id=criterion_set)<>17 then
   raise invalid_parameter_value using message='Exactly 17 matching legal criteria are required'; end if;
  if p_payload->'document' is distinct from 'null'::jsonb then
   if jsonb_typeof(p_payload->'document'->'sections') is distinct from 'array' then
    raise invalid_parameter_value using message='Legal sections are required'; end if;
   if exists(select 1 from jsonb_array_elements(p_payload->'document'->'sections') s
    where nullif(s->>'id','') is null or jsonb_typeof(s->'lines') is distinct from 'array') then
    raise invalid_parameter_value using message='Invalid legal section'; end if;
   if exists(select 1 from jsonb_array_elements(p_payload->'document'->'sections') s,
    jsonb_array_elements(s->'lines') l where nullif(l->>'id','') is null or jsonb_typeof(l->'text') is distinct from 'string') then
    raise invalid_parameter_value using message='Invalid legal text'; end if;
  end if;
 else raise invalid_parameter_value using message='Unknown publication entity type'; end if;
end; $$;
revoke all on function private.validate_publication_payload(text,jsonb,jsonb) from public,anon,authenticated;

-- Upsert existing node identities so report-to-provision links and old audit
-- references survive a corrected text. Removed nodes become non-public.
create function private.materialize_legal_working_copy(p_id uuid,p jsonb) returns void
language plpgsql set search_path=pg_catalog,public,private as $$
declare s jsonb; l jsonb; c jsonb; sid uuid; cid uuid; crit uuid;
begin
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
   where cs.name='한국·일본 개인정보 보호법 비교 기준' and cs.version=1 and cr.criterion_key=c->>'criterionId';
  insert into public.comparison_cells(criterion_id,law_version_id,summary_ko,status) values(crit,p_id,c->>'summary','unreviewed')
   on conflict(criterion_id,law_version_id) do update set summary_ko=excluded.summary_ko returning id into cid;
  delete from public.comparison_cell_provisions where comparison_cell_id=cid;
  insert into public.comparison_cell_provisions(comparison_cell_id,provision_node_id)
   select distinct cid,pn.id from jsonb_array_elements_text(coalesce(c->'translationLinks','[]'::jsonb)) x
   join public.provision_nodes pn on pn.law_version_id=p_id and pn.node_key=split_part(x,'#',2) on conflict do nothing;
 end loop;
end; $$;
revoke all on function private.materialize_legal_working_copy(uuid,jsonb) from public,anon,authenticated;

create function private.publication_workspace_result(w public.publication_working_copies) returns jsonb
language sql stable set search_path=pg_catalog,public as $$
 select jsonb_build_object('entity_type',w.entity_type,'entity_id',w.entity_id,'revision',w.revision,
 'published_revision',w.published_revision,'trashed_at',w.trashed_at,'requested_at',w.requested_at,
 'status',case when w.trashed_at is not null then 'trashed' when w.entity_type='report' then
 (select status from public.reports where id=w.entity_id) else (select status from public.law_versions where id=w.entity_id) end);
$$;
revoke all on function private.publication_workspace_result(public.publication_working_copies) from public,anon,authenticated;

create function private.apply_publication_workspace_action(p_action text,p_entity_type text,p_entity_id uuid,p_expected_revision bigint,p_payload jsonb default null) returns jsonb
language plpgsql security definer set search_path=pg_catalog,public,private as $$
declare w public.publication_working_copies; live_status text; live_payload jsonb; prior public.reports; v public.law_versions;
begin
 if auth.uid() is null or not private.is_team_member('editor') then raise insufficient_privilege using message='Active editor is required'; end if;
 if p_action not in ('save','publish','unpublish','trash','restore','request') or p_action is null
  or p_entity_type not in ('report','law') or p_entity_type is null or p_expected_revision is null then
  raise invalid_parameter_value using message='Invalid publication action'; end if;
 if p_action in ('publish','unpublish') and not private.is_team_member('admin') then
  raise insufficient_privilege using message='Active administrator is required'; end if;
 -- Lock the live parent before the draft, matching existing legal RPC lock order.
 if p_entity_type='report' then
  select * into prior from public.reports where id=p_entity_id for update;
  if not found then raise no_data_found using message='Publication record was not found'; end if;
  live_status:=prior.status; live_payload:=private.report_publication_payload(prior);
 else
  perform 1 from public.legal_instruments where id=(select legal_instrument_id from public.law_versions where id=p_entity_id) for update;
  select * into v from public.law_versions where id=p_entity_id for update;
  if not found or v.review_payload is null then raise no_data_found using message='Publication record was not found'; end if;
  live_status:=v.status; live_payload:=v.review_payload;
 end if;
 insert into public.publication_working_copies(entity_type,entity_id,payload,published_revision)
  values(p_entity_type,p_entity_id,live_payload,case when live_status='published' then 1 end) on conflict do nothing;
 select * into strict w from public.publication_working_copies where entity_type=p_entity_type and entity_id=p_entity_id for update;
 if w.revision<>p_expected_revision then
  if w.last_action=p_action and w.last_action_revision=p_expected_revision
   and (p_action<>'save' or w.payload=p_payload) then return private.publication_workspace_result(w); end if;
  raise serialization_failure using message='Publication draft changed; reload before retrying'; end if;
 if p_action='restore' then
  if w.trashed_at is null then return private.publication_workspace_result(w); end if;
  w.trashed_at:=null;
 elsif w.trashed_at is not null then
  raise invalid_parameter_value using message='Restore this material from the trash first';
 elsif p_action='save' then
  perform private.validate_publication_payload(p_entity_type,p_payload,live_payload);
  w.payload:=p_payload; w.requested_at:=null;
 elsif p_action='request' then
  perform private.validate_publication_payload(p_entity_type,w.payload,live_payload);
  if w.requested_at is not null then return private.publication_workspace_result(w); end if;
  w.requested_at:=now();
 elsif p_action='trash' then
  if live_status='published' then raise invalid_parameter_value using message='Unpublish this material before moving it to the trash'; end if;
  w.trashed_at:=now(); w.requested_at:=null;
 elsif p_action='unpublish' then
  if live_status<>'published' then return private.publication_workspace_result(w); end if;
  if p_entity_type='report' then update public.reports set status='draft' where id=p_entity_id;
  else
   update public.law_versions set status='draft' where id=p_entity_id;
   update public.provision_nodes set translation_status='draft' where law_version_id=p_entity_id;
   update public.comparison_cells set status='unreviewed' where law_version_id=p_entity_id;
  end if;
  w.published_revision:=null;
 elsif p_action='publish' then
  perform private.validate_publication_payload(p_entity_type,w.payload,live_payload);
  if live_status='published' and w.published_revision=w.revision then return private.publication_workspace_result(w); end if;
  -- Keep the previous published body in the team-only append-only audit trail.
  insert into public.review_events(entity_type,entity_id,action,actor_id,note)
   values(case when p_entity_type='report' then 'reports' else 'law_versions' end,p_entity_id,'previous_publication_preserved',auth.uid(),live_payload::text);
  if p_entity_type='report' then
   update public.reports set title_ko=w.payload->>'title_ko',one_line_summary_ko=w.payload->>'one_line_summary_ko',
    detailed_summary_ko=w.payload->>'detailed_summary_ko',jurisdictions=array(select jsonb_array_elements_text(w.payload->'jurisdictions')),
    topics=array(select jsonb_array_elements_text(w.payload->'topics')),key_points=coalesce(w.payload->'key_points','[]'::jsonb),
    policy_implications_ko=w.payload->>'policy_implications_ko',status='draft' where id=p_entity_id;
   update public.reports set status='approved' where id=p_entity_id;
   update public.reports set status='published' where id=p_entity_id;
  else
   update public.law_versions set status='draft',review_payload=w.payload,content_hash=w.payload->>'contentHash' where id=p_entity_id;
   perform private.materialize_legal_working_copy(p_entity_id,w.payload);
   perform public.advance_legal_review(p_entity_id,'verified',true);
   perform public.advance_legal_review(p_entity_id,'published',true);
   -- advance_legal_review marks all nodes public; obsolete nodes must stay hidden.
   update public.provision_nodes pn set translation_status='draft' where pn.law_version_id=p_entity_id and not exists(
    select 1 from jsonb_array_elements(coalesce(w.payload->'document'->'sections','[]'::jsonb)) s
     where pn.node_key=s->>'id' or exists(select 1 from jsonb_array_elements(s->'lines') l where pn.node_key=l->>'id'));
  end if;
  w.published_revision:=w.revision+1; w.requested_at:=null;
 end if;
 w.last_action:=p_action; w.last_action_revision:=p_expected_revision;
 w.revision:=w.revision+1; w.updated_at:=now();
 update public.publication_working_copies set revision=w.revision,payload=w.payload,published_revision=w.published_revision,
  trashed_at=w.trashed_at,requested_at=w.requested_at,updated_at=w.updated_at,last_action=w.last_action,last_action_revision=w.last_action_revision
  where entity_type=p_entity_type and entity_id=p_entity_id;
 insert into public.review_events(entity_type,entity_id,action,actor_id,note)
  values(case when p_entity_type='report' then 'reports' else 'law_versions' end,p_entity_id,'workspace_'||p_action,auth.uid(),jsonb_build_object('revision',w.revision)::text);
 return private.publication_workspace_result(w);
end; $$;
revoke all on function private.apply_publication_workspace_action(text,text,uuid,bigint,jsonb) from public,anon,authenticated;

create function public.save_publication_draft(p_entity_type text,p_entity_id uuid,p_expected_revision bigint,p_payload jsonb) returns jsonb
language sql security definer set search_path=pg_catalog,private as $$select private.apply_publication_workspace_action('save',p_entity_type,p_entity_id,p_expected_revision,p_payload);$$;
create function public.publish_publication_draft(p_entity_type text,p_entity_id uuid,p_expected_revision bigint) returns jsonb
language sql security definer set search_path=pg_catalog,private as $$select private.apply_publication_workspace_action('publish',p_entity_type,p_entity_id,p_expected_revision);$$;
create function public.unpublish_publication(p_entity_type text,p_entity_id uuid,p_expected_revision bigint) returns jsonb
language sql security definer set search_path=pg_catalog,private as $$select private.apply_publication_workspace_action('unpublish',p_entity_type,p_entity_id,p_expected_revision);$$;
create function public.trash_publication_draft(p_entity_type text,p_entity_id uuid,p_expected_revision bigint) returns jsonb
language sql security definer set search_path=pg_catalog,private as $$select private.apply_publication_workspace_action('trash',p_entity_type,p_entity_id,p_expected_revision);$$;
create function public.restore_publication_draft(p_entity_type text,p_entity_id uuid,p_expected_revision bigint) returns jsonb
language sql security definer set search_path=pg_catalog,private as $$select private.apply_publication_workspace_action('restore',p_entity_type,p_entity_id,p_expected_revision);$$;
create function public.request_publication_draft(p_entity_type text,p_entity_id uuid,p_expected_revision bigint) returns jsonb
language sql security definer set search_path=pg_catalog,private as $$select private.apply_publication_workspace_action('request',p_entity_type,p_entity_id,p_expected_revision);$$;
revoke all on function public.save_publication_draft(text,uuid,bigint,jsonb),public.publish_publication_draft(text,uuid,bigint),
 public.unpublish_publication(text,uuid,bigint),public.trash_publication_draft(text,uuid,bigint),public.restore_publication_draft(text,uuid,bigint),public.request_publication_draft(text,uuid,bigint) from public,anon;
grant execute on function public.save_publication_draft(text,uuid,bigint,jsonb),public.publish_publication_draft(text,uuid,bigint),
 public.unpublish_publication(text,uuid,bigint),public.trash_publication_draft(text,uuid,bigint),public.restore_publication_draft(text,uuid,bigint),public.request_publication_draft(text,uuid,bigint) to authenticated;

-- Grants remain available for legacy draft creation/editing. Public rows and
-- physical deletion cannot bypass the new revision, publication and trash flow.
-- SECURITY INVOKER deliberately distinguishes a Data API role from the owner
-- executing a vetted SECURITY DEFINER publication/import RPC.
create function private.guard_live_publication_workspace() returns trigger
language plpgsql security invoker set search_path=pg_catalog,public,private as $$
declare active boolean; old_law uuid; new_law uuid;
begin
 if current_user not in ('anon','authenticated') then
  if tg_op='DELETE' then return old; else return new; end if;
 end if;
 if tg_table_name in ('reports','law_versions') then
  if tg_op='DELETE' or old.status='published' or exists(select 1 from public.publication_working_copies
   where entity_type=case when tg_table_name='reports' then 'report' else 'law' end and entity_id=old.id and trashed_at is not null) then
   raise insufficient_privilege using message='Use the publication workspace to preserve the public version'; end if;
  if exists(select 1 from public.publication_working_copies where entity_id=old.id and last_action is not null
   and entity_type=case when tg_table_name='reports' then 'report' else 'law' end) then
   if tg_table_name='reports' then
    if (new.title_ko,new.one_line_summary_ko,new.detailed_summary_ko,new.jurisdictions,new.topics,new.key_points,new.policy_implications_ko)
     is distinct from (old.title_ko,old.one_line_summary_ko,old.detailed_summary_ko,old.jurisdictions,old.topics,old.key_points,old.policy_implications_ko) then
     raise insufficient_privilege using message='Use the publication workspace to preserve the public version'; end if;
   elsif (new.review_payload,new.content_hash) is distinct from (old.review_payload,old.content_hash) then
    raise insufficient_privilege using message='Use the publication workspace to preserve the public version';
   end if;
  end if;
 elsif tg_table_name='source_items' then
  if exists(select 1 from public.reports where source_item_id=old.id and status='published') then
   raise insufficient_privilege using message='Use the publication workspace to preserve the public version'; end if;
 else
  if tg_table_name='comparison_cell_provisions' then
   select exists(select 1 from public.comparison_cells c join public.law_versions v on v.id=c.law_version_id
    where (tg_op<>'INSERT' and c.id=old.comparison_cell_id or tg_op<>'DELETE' and c.id=new.comparison_cell_id) and v.status='published') into active;
  else
   if tg_op<>'INSERT' then old_law:=old.law_version_id; end if;
   if tg_op<>'DELETE' then new_law:=new.law_version_id; end if;
   select exists(select 1 from public.law_versions v where v.id in(old_law,new_law) and v.status='published') into active;
  end if;
  if active then raise insufficient_privilege using message='Use the publication workspace to preserve the public version'; end if;
 end if;
 if tg_op='DELETE' then return old; else return new; end if;
end; $$;
revoke all on function private.guard_live_publication_workspace() from public,anon,authenticated;
create trigger aa_guard_report_workspace before update or delete on public.reports for each row execute function private.guard_live_publication_workspace();
create trigger aa_guard_law_workspace before update or delete on public.law_versions for each row execute function private.guard_live_publication_workspace();
create trigger aa_guard_provision_workspace before insert or update or delete on public.provision_nodes for each row execute function private.guard_live_publication_workspace();
create trigger aa_guard_comparison_workspace before insert or update or delete on public.comparison_cells for each row execute function private.guard_live_publication_workspace();
create trigger aa_guard_relation_workspace before insert or update or delete on public.comparison_cell_provisions for each row execute function private.guard_live_publication_workspace();
create trigger aa_guard_source_item_workspace before update or delete on public.source_items for each row execute function private.guard_live_publication_workspace();
