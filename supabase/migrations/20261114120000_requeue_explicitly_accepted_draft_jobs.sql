-- An explicitly accepted current source revision must be draftable even if an
-- earlier date/evidence gate left its existing job cancelled. Reopen only that
-- exact job after editorial triage has marked the current revision accepted.
create or replace function public.collector_retain_for_draft(
  p_item_id uuid,
  p_revision_id uuid,
  p_input_hash text,
  p_reason text
) returns jsonb
language plpgsql
set search_path=public,pg_temp as $$
declare
  i public.source_items;
  r public.source_item_revisions;
  j public.draft_jobs;
  v_explicitly_accepted boolean;
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
  if r.metadata->>'ai_ready' is distinct from 'true' and i.published_at is not null then
    raise exception 'retention_source_not_ai_ready' using errcode='22023';
  end if;
  if not exists(select 1 from public.sources where id=i.source_id and is_active and terms_reviewed_at is not null) then
    raise exception 'retention_source_not_verified' using errcode='22023';
  end if;
  if exists(select 1 from public.reports where source_item_id=i.id) then
    return jsonb_build_object('status','existing_report_preserved','item_id',i.id);
  end if;

  select exists (
    select 1 from public.source_items accepted_item
    where accepted_item.id=i.id
      and accepted_item.current_revision_id=r.id
      and accepted_item.relevance_status='relevant'
      and accepted_item.metadata->'editorial_triage'->>'decision'='accepted'
      and accepted_item.metadata->'editorial_triage'->>'source_item_revision_id'=r.id::text
      and not exists(select 1 from public.reports rep where rep.source_item_id=accepted_item.id)
  ) into v_explicitly_accepted;

  insert into public.draft_jobs(source_item_id,source_item_revision_id,instruction_version,input_hash)
  values(i.id,r.id,'trend-ko-v1',r.content_hash)
  on conflict(source_item_id,instruction_version,input_hash)
  do update set
    source_item_revision_id=excluded.source_item_revision_id,
    status=case when public.draft_jobs.status='cancelled' and v_explicitly_accepted then 'pending'
      else public.draft_jobs.status end,
    attempts=case when public.draft_jobs.status='cancelled' and v_explicitly_accepted then 0
      else public.draft_jobs.attempts end,
    claimed_by=case when public.draft_jobs.status='cancelled' and v_explicitly_accepted then null
      else public.draft_jobs.claimed_by end,
    claimed_at=case when public.draft_jobs.status='cancelled' and v_explicitly_accepted then null
      else public.draft_jobs.claimed_at end,
    lease_until=case when public.draft_jobs.status='cancelled' and v_explicitly_accepted then null
      else public.draft_jobs.lease_until end,
    last_error=case when public.draft_jobs.status='cancelled' and v_explicitly_accepted
      then left('Requeued after explicit current-revision editorial acceptance. Previous cancellation: '
        ||coalesce(public.draft_jobs.last_error,'(none)'),1000)
      else public.draft_jobs.last_error end,
    updated_at=case when public.draft_jobs.status='cancelled' and v_explicitly_accepted then now()
      else public.draft_jobs.updated_at end
  returning * into j;

  update public.source_items set relevance_status='relevant',
    metadata=metadata||jsonb_build_object('retention_decision','keep',
      'retention_revision',r.id,'retention_reason',p_reason,'retained_at',now()),
    updated_at=now() where id=i.id;
  return jsonb_build_object('status','draft_required','item_id',i.id,'job_id',j.id,
    'revision_id',r.id,'input_hash',r.content_hash,'job_status',j.status,'attempts',j.attempts);
end;
$$;
