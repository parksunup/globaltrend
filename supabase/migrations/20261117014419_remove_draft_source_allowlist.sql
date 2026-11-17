-- Remove the duplicate 31-source drafting cohort gate. Every registered source
-- may enter the same draft workflow; collection and editorial checks remain
-- separate. A deliberately inactive source is not collected, but already
-- stored records are not blocked from drafting solely by cohort or activity.
create or replace function private.trend_draft_source_allowed(p_source_id uuid)
returns boolean
language sql
stable
parallel safe
set search_path = pg_catalog, public
as $$
  select exists (
    select 1
    from public.sources s
    where s.id = p_source_id
  );
$$;

-- Keep meaningful failure text if a malformed/orphaned source record is ever
-- passed to retention or submission.
create or replace function public.collector_retain_for_draft(
  p_item_id uuid,
  p_revision_id uuid,
  p_input_hash text,
  p_reason text
) returns jsonb
language plpgsql
set search_path = pg_catalog, public
as $$
declare i public.source_items; r public.source_item_revisions; j public.draft_jobs;
begin
  select * into strict i from public.source_items where id=p_item_id for update;
  select * into strict r from public.source_item_revisions where id=p_revision_id;
  if i.current_revision_id is distinct from r.id or r.source_item_id is distinct from i.id
     or r.content_hash is distinct from p_input_hash then
    raise exception 'retention_input_revision_mismatch' using errcode='22023';
  end if;
  if nullif(btrim(p_reason),'') is null then
    raise exception 'retention_reason_missing' using errcode='22023';
  end if;
  if nullif(btrim(r.content_text),'') is null then
    raise exception 'retention_source_text_empty' using errcode='22023';
  end if;
  if not private.trend_draft_source_allowed(i.source_id) then
    raise exception 'retention_source_not_registered' using errcode='42501';
  end if;
  if exists(select 1 from public.reports where source_item_id=i.id) then
    return jsonb_build_object('status','existing_report_preserved','item_id',i.id);
  end if;
  insert into public.draft_jobs(source_item_id,source_item_revision_id,instruction_version,input_hash)
  values(i.id,r.id,'trend-ko-v1',r.content_hash)
  on conflict(source_item_id,instruction_version,input_hash)
  do update set source_item_revision_id=excluded.source_item_revision_id
  returning * into j;
  update public.source_items set relevance_status='relevant',
    metadata=metadata||jsonb_build_object('retention_decision','keep','retention_revision',r.id,
      'retention_reason',p_reason,'retained_at',now()),updated_at=now()
  where id=i.id;
  return jsonb_build_object('status','draft_required','item_id',i.id,'job_id',j.id,
    'revision_id',r.id,'input_hash',r.content_hash,'job_status',j.status,'attempts',j.attempts);
end;
$$;

revoke all on function private.trend_draft_source_allowed(uuid) from public, anon, authenticated, service_role;
grant execute on function private.trend_draft_source_allowed(uuid) to service_role;

do $update_submit_error$
declare definition text;
begin
  definition := pg_get_functiondef('public.submit_trend_draft(uuid,text,jsonb)'::regprocedure);
  if position('Source approval was revoked' in definition) = 0 then
    raise exception 'draft submit source gate error anchor drift';
  end if;
  execute replace(definition, 'Source approval was revoked', 'Registered source record is missing');
end;
$update_submit_error$;
