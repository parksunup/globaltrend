-- Keep editorial triage available for any non-empty current source body.
-- Long PDF/text extraction is not an editorial error and has no arbitrary cap.
create or replace function public.record_trend_editorial_triage(
  p_decision_id uuid,
  p_source_item_id uuid,
  p_source_item_revision_id uuid,
  p_input_hash text,
  p_decision text,
  p_reason text,
  p_decision_version text,
  p_metadata jsonb default '{}'::jsonb
) returns jsonb
language plpgsql security invoker
set search_path=pg_catalog,public,pg_temp as $$
declare item public.source_items; revision public.source_item_revisions;
  saved public.trend_editorial_triage_decisions; retained jsonb;
begin
  if p_decision_id is null or p_decision is null
    or p_decision not in ('accepted','irrelevant','low_significance','needs_review')
    or p_input_hash is null or p_input_hash !~ '^[0-9a-f]{64}$'
    or nullif(btrim(p_reason),'') is null or length(p_reason)>2000
    or nullif(btrim(p_decision_version),'') is null or length(p_decision_version)>80
    or jsonb_typeof(coalesce(p_metadata,'{}'::jsonb)) is distinct from 'object' then
    raise invalid_parameter_value using message='editorial_triage_invalid';
  end if;
  select * into strict item from public.source_items where id=p_source_item_id for update;
  select * into strict revision from public.source_item_revisions where id=p_source_item_revision_id;
  if item.current_revision_id is distinct from revision.id
    or revision.source_item_id is distinct from item.id
    or revision.content_hash is distinct from p_input_hash
    or item.content_hash is distinct from p_input_hash
    or nullif(btrim(revision.content_text),'') is null then
    raise invalid_parameter_value using message='editorial_triage_input_revision_mismatch_or_empty';
  end if;
  if exists(select 1 from public.reports where source_item_id=item.id) then
    return jsonb_build_object('status','existing_report_preserved','item_id',item.id);
  end if;
  if exists(select 1 from public.draft_jobs where source_item_id=item.id and status='claimed' and lease_until>clock_timestamp()) then
    raise serialization_failure using message='editorial_triage_job_claimed';
  end if;
  if exists(select 1 from public.trend_editorial_triage_decisions where id=p_decision_id) then
    select * into strict saved from public.trend_editorial_triage_decisions where id=p_decision_id;
    if saved.source_item_revision_id is distinct from revision.id or saved.input_hash is distinct from p_input_hash then
      raise unique_violation using message='editorial_triage_decision_id_reused';
    end if;
    return jsonb_build_object('status','already_recorded','decision',saved.decision,'decision_id',saved.id);
  end if;
  if p_decision='accepted' and not exists(
    select 1 from public.sources where id=item.source_id and is_active and terms_reviewed_at is not null
  ) then
    raise invalid_parameter_value using message='editorial_triage_source_not_approved';
  end if;
  insert into public.trend_editorial_triage_decisions
    (id,source_item_id,source_item_revision_id,input_hash,decision,reason,decision_version,metadata)
  values(p_decision_id,item.id,revision.id,p_input_hash,p_decision,btrim(p_reason),
    btrim(p_decision_version),coalesce(p_metadata,'{}'::jsonb)) returning * into saved;

  if p_decision='accepted' then
    update public.source_item_revisions set metadata=metadata||jsonb_build_object(
      'ai_ready',true,'editorial_triage_decision_id',saved.id,
      'editorial_triage_version',p_decision_version,'editorial_triage_reason',btrim(p_reason)
    ) where id=revision.id;
    update public.source_items set relevance_status='relevant',metadata=metadata||jsonb_build_object(
      'ai_ready',true,'editorial_triage',jsonb_build_object('decision','accepted',
      'decision_id',saved.id,'version',p_decision_version,'reason',btrim(p_reason),
      'source_item_revision_id',revision.id)),updated_at=clock_timestamp() where id=item.id;
    retained=public.collector_retain_for_draft(item.id,revision.id,p_input_hash,
      'Accepted by cross-source editorial triage: '||btrim(p_reason));
    return jsonb_build_object('status',retained->>'status','decision','accepted',
      'decision_id',saved.id,'item_id',item.id,'revision_id',revision.id,'job_id',retained->>'job_id');
  elsif p_decision in ('irrelevant','low_significance') then
    update public.source_items set relevance_status='irrelevant',pipeline_status='ignored',
      metadata=metadata||jsonb_build_object('editorial_triage',jsonb_build_object(
        'decision',p_decision,'decision_id',saved.id,'version',p_decision_version,
        'reason',btrim(p_reason),'source_item_revision_id',revision.id)),
      updated_at=clock_timestamp() where id=item.id;
  else
    update public.source_items set relevance_status='needs_review',
      metadata=metadata||jsonb_build_object('editorial_triage',jsonb_build_object(
        'decision','needs_review','decision_id',saved.id,'version',p_decision_version,
        'reason',btrim(p_reason),'source_item_revision_id',revision.id)),
      updated_at=clock_timestamp() where id=item.id;
  end if;
  return jsonb_build_object('status','recorded','decision',p_decision,'decision_id',saved.id,'item_id',item.id);
end;
$$;
revoke all on function public.record_trend_editorial_triage(uuid,uuid,uuid,text,text,text,text,jsonb)
  from public,anon,authenticated;
grant execute on function public.record_trend_editorial_triage(uuid,uuid,uuid,text,text,text,text,jsonb)
  to service_role;

-- Do not reject an otherwise usable source because its extracted text is long.
-- Report each true retention precondition separately instead of masking it.
create or replace function public.collector_retain_for_draft(
  p_item_id uuid,
  p_revision_id uuid,
  p_input_hash text,
  p_reason text
) returns jsonb
language plpgsql
set search_path=public,pg_temp as $$
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
  if r.metadata->>'ai_ready' is distinct from 'true' and i.published_at is not null then
    raise exception 'retention_source_not_ai_ready' using errcode='22023';
  end if;
  if not exists(select 1 from public.sources where id=i.source_id and is_active and terms_reviewed_at is not null) then
    raise exception 'retention_source_not_verified' using errcode='22023';
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
    metadata=metadata||jsonb_build_object('retention_decision','keep',
      'retention_revision',r.id,'retention_reason',p_reason,'retained_at',now()),
    updated_at=now() where id=i.id;
  return jsonb_build_object('status','draft_required','item_id',i.id,'job_id',j.id,
    'revision_id',r.id,'input_hash',r.content_hash,'job_status',j.status,'attempts',j.attempts);
end;
$$;
