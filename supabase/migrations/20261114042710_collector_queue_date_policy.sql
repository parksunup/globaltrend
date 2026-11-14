-- Keep one actionable job per source item. Source revisions remain as evidence;
-- superseded/unneeded draft *jobs* are removed rather than shown as pending.
create function private.prune_unneeded_draft_jobs(p_item_id uuid, p_keep_job_id uuid default null)
returns void language plpgsql security definer set search_path=pg_catalog,public,pg_temp as $$
begin
  delete from public.draft_jobs j
  using public.source_items i
  where i.id=p_item_id and j.source_item_id=i.id
    and j.status<>'submitted'
    and (p_keep_job_id is null or j.id<>p_keep_job_id)
    and (j.source_item_revision_id is distinct from i.current_revision_id
      or i.relevance_status='irrelevant'
      or exists(select 1 from public.reports rp where rp.source_item_id=i.id));
end; $$;
revoke all on function private.prune_unneeded_draft_jobs(uuid,uuid) from public,anon,authenticated;

create function private.prune_draft_jobs_after_source_change() returns trigger
language plpgsql security definer set search_path=pg_catalog,public,pg_temp as $$
begin
  perform private.prune_unneeded_draft_jobs(new.id,null);
  return new;
end; $$;
create trigger prune_draft_jobs_after_source_change
after update of current_revision_id,relevance_status on public.source_items
for each row execute function private.prune_draft_jobs_after_source_change();
revoke all on function private.prune_draft_jobs_after_source_change() from public,anon,authenticated;

create function private.prune_draft_jobs_after_report() returns trigger
language plpgsql security definer set search_path=pg_catalog,public,pg_temp as $$
declare active_job uuid;
begin
  if coalesce(new.automation_metadata->>'job_id','') ~* '^[0-9a-f-]{36}$' then
    active_job=(new.automation_metadata->>'job_id')::uuid;
  end if;
  perform private.prune_unneeded_draft_jobs(new.source_item_id,active_job);
  return new;
end; $$;
create trigger prune_draft_jobs_after_report
after insert on public.reports for each row
execute function private.prune_draft_jobs_after_report();
revoke all on function private.prune_draft_jobs_after_report() from public,anon,authenticated;

-- The ingest RPC inserts a job before any editorial decision. Do not insert a
-- fresh job when the source already has a report or has been rejected.
create function private.guard_unneeded_draft_job() returns trigger
language plpgsql security definer set search_path=pg_catalog,public,pg_temp as $$
begin
  if exists(select 1 from public.source_items i where i.id=new.source_item_id
      and (i.relevance_status='irrelevant'
        or i.current_revision_id is distinct from new.source_item_revision_id
        or exists(select 1 from public.reports rp where rp.source_item_id=i.id))) then
    return null;
  end if;
  return new;
end; $$;
create trigger guard_unneeded_draft_job
before insert on public.draft_jobs for each row
execute function private.guard_unneeded_draft_job();
revoke all on function private.guard_unneeded_draft_job() from public,anon,authenticated;

-- Read only an explicit publication label or a listing publication label.
-- A yearless day/month uses the collection year, as requested; this is
-- recorded so it is distinguishable from an explicit year. Conflicts stay null.
create function private.collector_date_evidence(p_item public.source_items,p_revision public.source_item_revisions)
returns jsonb language plpgsql stable set search_path=pg_catalog,public,pg_temp as $$
declare o jsonb; value text; meaning text; m text[]; candidate date; selected date;
  month_number integer; year_number integer; inferred boolean=false; selected_inferred boolean=false;
  host text=lower(split_part(split_part(p_item.canonical_url,'/',3),':',1));
begin
  for o in select x.value from jsonb_array_elements(case when jsonb_typeof(p_revision.metadata->'date_observations')='array' then p_revision.metadata->'date_observations' else '[]'::jsonb end) x loop
    meaning=o->>'meaning'; value=trim(coalesce(o->>'value',''));
    if meaning not in ('listing_published_display','listing_date_unqualified','listing_date_candidate','expansion_listing_published','official_published_attribute') then continue; end if;
    candidate=null; inferred=false;
    begin
      m=regexp_match(value,'^([0-9]{4})-([0-9]{2})-([0-9]{2})(?:T.*)?$');
      if m is not null then candidate=make_date(m[1]::integer,m[2]::integer,m[3]::integer); end if;
      if candidate is null then
        m=regexp_match(value,'^([0-9]{1,2})\.([0-9]{1,2})\.([0-9]{4})$');
        if m is not null then candidate=make_date(m[3]::integer,m[2]::integer,m[1]::integer); end if;
      end if;
      if candidate is null then
        m=regexp_match(value,'^([0-9]{1,2})[[:space:]]+([A-Za-z]{3})\.?[[:space:]]+([0-9]{4})$');
        if m is not null then
          month_number=array_position(array['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'],lower(m[2]));
          if month_number is not null then candidate=make_date(m[3]::integer,month_number,m[1]::integer); end if;
        end if;
      end if;
      if candidate is null and meaning='listing_date_unqualified' then
        m=regexp_match(value,'^([A-Za-z]{3})[[:space:]]+([0-9]{1,2})$');
        if m is not null then
          month_number=array_position(array['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'],lower(m[1]));
          year_number=extract(year from coalesce(p_item.fetched_at,p_item.discovered_at,now()))::integer;
          if month_number is not null then candidate=make_date(year_number,month_number,m[2]::integer); inferred=true; end if;
        end if;
      end if;
    exception when datetime_field_overflow or invalid_datetime_format then candidate=null;
    end;
    if candidate is null then continue; end if;
    if selected is not null and selected<>candidate then return null; end if;
    selected=candidate; selected_inferred=selected_inferred or inferred;
  end loop;
  if host in ('www.freevacy.com','freevacy.com') then
    m=regexp_match(left(p_revision.content_text,800),'Published:[[:space:]]*([0-9]{1,2})/([0-9]{1,2})/([0-9]{4})','i');
    if m is not null then
      begin candidate=make_date(m[3]::integer,m[2]::integer,m[1]::integer);
      exception when datetime_field_overflow or invalid_datetime_format then candidate=null; end;
      if candidate is not null and selected is not null and selected<>candidate then return null; end if;
      if candidate is not null then selected=candidate; selected_inferred=false; end if;
    end if;
  end if;
  if selected is null then return null; end if;
  return jsonb_build_object('date',selected,'precision','day','year_inferred',selected_inferred,'method','explicit_publication_label_or_listing');
end; $$;
revoke all on function private.collector_date_evidence(public.source_items,public.source_item_revisions) from public,anon,authenticated;

create function private.resolve_collector_date_on_revision() returns trigger
language plpgsql security definer set search_path=pg_catalog,public,pg_temp as $$
declare revision public.source_item_revisions; resolution jsonb;
begin
  if new.published_at is not null or new.current_revision_id is null then return new; end if;
  select * into revision from public.source_item_revisions where id=new.current_revision_id;
  if not found then return new; end if;
  resolution=private.collector_date_evidence(new,revision);
  if resolution is not null then
    new.published_at=((resolution->>'date')::date)::timestamp at time zone 'UTC';
    new.metadata=new.metadata||jsonb_build_object('publication_date_resolution',resolution);
  end if;
  return new;
end; $$;
create trigger resolve_collector_date_on_revision
before update of current_revision_id on public.source_items
for each row execute function private.resolve_collector_date_on_revision();
revoke all on function private.resolve_collector_date_on_revision() from public,anon,authenticated;

-- Remove the former date-only veto. Weekly selection still requires a real
-- source publication day, while ordinary searchable reports may have none.
drop trigger if exists collector_require_auto_report_date_before_insert on public.reports;
drop function if exists private.collector_require_auto_report_date();

-- Preserve every other writing gate. A missing date by itself is not an
-- AI-readiness failure; the Codex writer must still read and verify the body.
do $$
declare definition text; original text;
begin
  definition=pg_get_functiondef('public.claim_trend_draft_jobs(text,integer,uuid)'::regprocedure);
  original=definition;
  definition=replace(definition,
    'and s.is_active and s.terms_reviewed_at is not null and r.metadata->>''ai_ready'' = ''true''',
    'and s.is_active and s.terms_reviewed_at is not null and (r.metadata->>''ai_ready'' = ''true'' or si.published_at is null)');
  definition=replace(definition,'and si.published_at is not null and si.relevance_status', 'and si.relevance_status');
  if definition=original or position('and si.published_at is not null and si.relevance_status' in definition)>0 then raise exception 'draft claim definition changed; review required'; end if;
  execute definition;

  definition=pg_get_functiondef('public.submit_trend_draft(uuid,text,jsonb)'::regprocedure);
  original=definition;
  definition=replace(definition,
    'or r.metadata->>''ai_ready'' is distinct from ''true'' then',
    'or (r.metadata->>''ai_ready'' is distinct from ''true'' and si.published_at is not null) then');
  if definition=original then raise exception 'draft submission definition changed; review required'; end if;
  execute definition;

  definition=pg_get_functiondef('public.collector_retain_for_draft(uuid,uuid,text,text)'::regprocedure);
  original=definition;
  definition=replace(definition,'or i.published_at is null or length(r.content_text)', 'or length(r.content_text)');
  definition=replace(definition,
    'or r.metadata->>''ai_ready'' is distinct from ''true'' or not exists',
    'or (r.metadata->>''ai_ready'' is distinct from ''true'' and i.published_at is not null) or not exists');
  if definition=original or position('or i.published_at is null or length(r.content_text)' in definition)>0 then raise exception 'draft retention definition changed; review required'; end if;
  execute definition;
end $$;

-- Existing records get the same rules. Submitted jobs and source revisions
-- remain for provenance; only unnecessary unfinished jobs are deleted.
update public.source_items i set published_at=((private.collector_date_evidence(i,r)->>'date')::date)::timestamp at time zone 'UTC',
  metadata=i.metadata||jsonb_build_object('publication_date_resolution',private.collector_date_evidence(i,r)),updated_at=now()
from public.source_item_revisions r
where r.id=i.current_revision_id and i.published_at is null
  and not exists(select 1 from public.reports rp where rp.source_item_id=i.id)
  and private.collector_date_evidence(i,r) is not null;

delete from public.draft_jobs j using public.source_items i
where j.source_item_id=i.id and j.status<>'submitted'
  and (j.source_item_revision_id is distinct from i.current_revision_id
    or i.relevance_status='irrelevant'
    or exists(select 1 from public.reports rp where rp.source_item_id=i.id));
