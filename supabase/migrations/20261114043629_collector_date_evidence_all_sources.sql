-- Date evidence is evaluated across every source, not a short list of hosts.
-- Reconsider conflicting observations and the extraction metadata together.
create or replace function private.collector_date_evidence(p_item public.source_items,p_revision public.source_item_revisions)
returns jsonb language plpgsql stable set search_path=pg_catalog,public,pg_temp as $$
declare o jsonb; value text; meaning text; m text[]; candidate date; selected date;
  month_number integer; year_number integer; inferred boolean=false; selected_inferred boolean=false;
  method text; selected_method text; reference_day date=coalesce(p_item.fetched_at,p_item.discovered_at,now())::date;
begin
  for o in select x.value from jsonb_array_elements(case when jsonb_typeof(p_revision.metadata->'date_observations')='array' then p_revision.metadata->'date_observations' else '[]'::jsonb end) x loop
    meaning=o->>'meaning'; value=trim(coalesce(o->>'value',''));
    if meaning is null or not (meaning ilike '%publish%' or meaning in ('listing_date_unqualified','listing_date_candidate','notice_date_candidate')) then continue; end if;
    if meaning='route_month_candidate_not_full_date' then continue; end if;
    candidate=null; inferred=false;
    begin
      m=regexp_match(value,'^([0-9]{4})-([0-9]{2})-([0-9]{2})(T.*)?$');
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
          year_number=extract(year from reference_day)::integer;
          if month_number is not null then
            candidate=make_date(year_number,month_number,m[2]::integer);
            if candidate>reference_day then candidate=make_date(year_number-1,month_number,m[2]::integer); end if;
            inferred=true;
          end if;
        end if;
      end if;
    exception when datetime_field_overflow or invalid_datetime_format then candidate=null;
    end;
    if candidate is null then continue; end if;
    if selected is not null and selected<>candidate then return null; end if;
    selected=candidate; selected_inferred=selected_inferred or inferred; selected_method='date_observation:'||meaning;
  end loop;

  -- A labeled publication date in the extracted opening is stronger than a
  -- date merely mentioned in the story. An unlabeled event date is ignored.
  m=regexp_match(left(p_revision.content_text,800),'Published:[[:space:]]*([0-9]{1,2})/([0-9]{1,2})/([0-9]{4})','i');
  if m is not null then
    begin candidate=make_date(m[3]::integer,m[2]::integer,m[1]::integer);
    exception when datetime_field_overflow or invalid_datetime_format then candidate=null; end;
    if candidate is not null and selected is not null and selected<>candidate then return null; end if;
    if candidate is not null then selected=candidate; selected_inferred=false; selected_method='body_published_label'; end if;
  end if;
  m=regexp_match(left(p_revision.content_text,800),'Posted on[[:space:]]+([0-9]{1,2})[[:space:]]+([A-Za-z]+)[[:space:]]+([0-9]{4})','i');
  if m is not null then
    month_number=array_position(array['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'],lower(left(m[2],3)));
    if month_number is not null then
      begin candidate=make_date(m[3]::integer,month_number,m[1]::integer);
      exception when datetime_field_overflow or invalid_datetime_format then candidate=null; end;
      if candidate is not null and selected is not null and selected<>candidate then return null; end if;
      if candidate is not null then selected=candidate; selected_inferred=false; selected_method='body_posted_on_label'; end if;
    end if;
  end if;

  -- Trafilatura's date is a candidate, never a reason to override a
  -- contradictory explicit observation or publication label.
  value=p_revision.metadata->>'trafilatura_date_candidate';
  m=regexp_match(coalesce(value,''),'^([0-9]{4})-([0-9]{2})-([0-9]{2})$');
  if m is not null then
    begin candidate=make_date(m[1]::integer,m[2]::integer,m[3]::integer);
    exception when datetime_field_overflow or invalid_datetime_format then candidate=null; end;
    if candidate is not null and selected is not null and selected<>candidate then return null; end if;
    if candidate is not null and selected is null then selected=candidate; selected_method='trafilatura_date_candidate'; end if;
  end if;
  if selected is null then return null; end if;
  return jsonb_build_object('date',selected,'precision','day','year_inferred',selected_inferred,'method',selected_method);
end; $$;

-- A checked UUID avoids breaking report creation on malformed metadata.
create or replace function private.prune_draft_jobs_after_report() returns trigger
language plpgsql security definer set search_path=pg_catalog,public,pg_temp as $$
declare active_job uuid;
begin
  if coalesce(new.automation_metadata->>'job_id','') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    active_job=(new.automation_metadata->>'job_id')::uuid;
  end if;
  perform private.prune_unneeded_draft_jobs(new.source_item_id,active_job);
  return new;
end; $$;

-- Remember that an undated item was legitimately leased for drafting. A
-- later date recovery must not invalidate that same in-flight draft.
alter table public.draft_jobs add column date_absent_at_claim boolean not null default false;
do $$
declare definition text; original text;
begin
  definition=pg_get_functiondef('public.claim_trend_draft_jobs(text,integer,uuid)'::regprocedure);
  original=definition;
  definition=replace(definition,'last_error = null, updated_at = now()',
    'last_error = null, date_absent_at_claim = (select si.published_at is null from public.source_items si where si.id=j.source_item_id), updated_at = now()');
  if definition=original then raise exception 'claim lease definition changed; review required'; end if;
  execute definition;
  definition=pg_get_functiondef('public.submit_trend_draft(uuid,text,jsonb)'::regprocedure);
  original=definition;
  definition=replace(definition,
    'and si.published_at is not null) then',
    'and si.published_at is not null and not j.date_absent_at_claim) then');
  if definition=original then raise exception 'draft submit date transition definition changed; review required'; end if;
  execute definition;
end $$;

-- Re-evaluate every date assigned by the previous migration, then evaluate
-- every still-undated current revision. No source-name whitelist is used.
update public.source_items i
set published_at=case when private.collector_date_evidence(i,r) is null then null else ((private.collector_date_evidence(i,r)->>'date')::date)::timestamp at time zone 'UTC' end,
    metadata=case when private.collector_date_evidence(i,r) is null then i.metadata-'publication_date_resolution'
      else i.metadata||jsonb_build_object('publication_date_resolution',private.collector_date_evidence(i,r)) end,
    updated_at=now()
from public.source_item_revisions r
where r.id=i.current_revision_id and i.metadata ? 'publication_date_resolution';

update public.source_items i
set published_at=((private.collector_date_evidence(i,r)->>'date')::date)::timestamp at time zone 'UTC',
    metadata=i.metadata||jsonb_build_object('publication_date_resolution',private.collector_date_evidence(i,r)),updated_at=now()
from public.source_item_revisions r
where r.id=i.current_revision_id and i.published_at is null
  and not exists(select 1 from public.reports rp where rp.source_item_id=i.id)
  and private.collector_date_evidence(i,r) is not null;
