-- Durable record for the new Scrapling collector and its pre-draft filter.
-- Source text and revisions remain in source_items/source_item_revisions.
create table public.scrapling_collection_runs (
  id uuid primary key,
  execution_id text not null unique check (length(execution_id) between 1 and 200),
  range_start date not null,
  range_end date not null,
  started_at timestamptz not null,
  finished_at timestamptz not null,
  status text not null check (status in ('running','complete','partial','failed')),
  git_sha text check (git_sha is null or git_sha ~ '^[0-9a-f]{7,64}$'),
  result jsonb not null default '{}'::jsonb check (jsonb_typeof(result) = 'object'),
  writer_execution_id text,
  writer_started_at timestamptz,
  writer_finished_at timestamptz,
  writer_status text not null default 'pending' check (writer_status in ('pending','running','idle','complete','partial','failed')),
  writer_result jsonb not null default '{}'::jsonb check (jsonb_typeof(writer_result) = 'object'),
  created_at timestamptz not null default clock_timestamp(),
  check (range_start <= range_end),
  check (finished_at >= started_at)
);

create table public.scrapling_filter_decisions (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.scrapling_collection_runs(id) on delete restrict,
  source_item_id uuid not null references public.source_items(id) on delete restrict,
  source_item_revision_id uuid not null references public.source_item_revisions(id) on delete restrict,
  input_hash text not null check (input_hash ~ '^[0-9a-f]{64}$'),
  decision text not null check (decision in (
    'accepted','exact_duplicate','same_event_duplicate','irrelevant','needs_review','source_held'
  )),
  matched_source_item_id uuid references public.source_items(id) on delete restrict,
  matched_report_id uuid references public.reports(id) on delete restrict,
  match_method text,
  reason text not null check (length(btrim(reason)) between 1 and 2000),
  filter_version text not null check (length(btrim(filter_version)) between 1 and 80),
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default clock_timestamp(),
  unique (run_id, source_item_revision_id),
  check (source_item_id <> matched_source_item_id or matched_source_item_id is null),
  check (decision not in ('exact_duplicate','same_event_duplicate') or
    matched_source_item_id is not null or matched_report_id is not null)
);

create index scrapling_filter_pending_idx
  on public.scrapling_filter_decisions (created_at desc, decision);
create index scrapling_filter_item_idx
  on public.scrapling_filter_decisions (source_item_id, created_at desc);

alter table public.scrapling_collection_runs enable row level security;
alter table public.scrapling_filter_decisions enable row level security;
revoke all on public.scrapling_collection_runs, public.scrapling_filter_decisions
  from public, anon, authenticated;
grant select, insert, update on public.scrapling_collection_runs to service_role;
grant select, insert on public.scrapling_filter_decisions to service_role;

create function public.record_scrapling_collection_run(
  p_id uuid,
  p_execution_id text,
  p_range_start date,
  p_range_end date,
  p_started_at timestamptz,
  p_finished_at timestamptz,
  p_status text,
  p_git_sha text,
  p_result jsonb
) returns jsonb
language plpgsql security invoker
set search_path = pg_catalog, public, pg_temp as $$
declare saved public.scrapling_collection_runs;
begin
  if p_id is null or nullif(btrim(p_execution_id),'') is null
    or p_range_start is null or p_range_end is null or p_range_start > p_range_end
    or p_started_at is null or p_finished_at is null or p_finished_at < p_started_at
    or p_status is null or p_status not in ('running','complete','partial','failed')
    or jsonb_typeof(p_result) is distinct from 'object'
    or (p_git_sha is not null and p_git_sha !~ '^[0-9a-f]{7,64}$') then
    raise invalid_parameter_value using message = 'scrapling_run_invalid';
  end if;
  insert into public.scrapling_collection_runs
    (id,execution_id,range_start,range_end,started_at,finished_at,status,git_sha,result)
  values (p_id,p_execution_id,p_range_start,p_range_end,p_started_at,p_finished_at,p_status,p_git_sha,p_result)
  on conflict (execution_id) do update set
    range_start=excluded.range_start,
    range_end=excluded.range_end,
    finished_at=excluded.finished_at,
    status=excluded.status,
    git_sha=coalesce(excluded.git_sha,public.scrapling_collection_runs.git_sha),
    result=excluded.result
  where public.scrapling_collection_runs.id=excluded.id
    and public.scrapling_collection_runs.status='running'
    and excluded.status<>'running';
  select * into strict saved from public.scrapling_collection_runs where execution_id=p_execution_id;
  if saved.id is distinct from p_id then
    raise unique_violation using message = 'scrapling_execution_id_reused';
  end if;
  return jsonb_build_object('run_id',saved.id,'execution_id',saved.execution_id,'status',saved.status);
end;
$$;

create function public.record_scrapling_writer_run(
  p_run_id uuid,
  p_execution_id text,
  p_started_at timestamptz,
  p_finished_at timestamptz,
  p_status text,
  p_result jsonb
) returns jsonb
language plpgsql security invoker
set search_path = pg_catalog, public, pg_temp as $$
declare saved public.scrapling_collection_runs;
begin
  if p_run_id is null or nullif(btrim(p_execution_id),'') is null
    or p_started_at is null or p_finished_at is null or p_finished_at < p_started_at
    or p_status is null or p_status not in ('running','idle','complete','partial','failed')
    or jsonb_typeof(p_result) is distinct from 'object' then
    raise invalid_parameter_value using message = 'scrapling_writer_run_invalid';
  end if;
  update public.scrapling_collection_runs set
    writer_execution_id=p_execution_id,
    writer_started_at=case when p_status='running' then p_started_at else coalesce(writer_started_at,p_started_at) end,
    writer_finished_at=case when p_status='running' then null else p_finished_at end,
    writer_status=p_status,
    writer_result=p_result
  where id=p_run_id
    and (writer_status='pending' or writer_execution_id=p_execution_id
      or (writer_status in ('failed','partial','running') and writer_started_at < clock_timestamp()-interval '2 hours'));
  if not found then
    select * into strict saved from public.scrapling_collection_runs where id=p_run_id;
    if saved.writer_execution_id=p_execution_id and saved.writer_status=p_status then
      return jsonb_build_object('run_id',saved.id,'writer_status',saved.writer_status,'status','already_recorded');
    end if;
    raise serialization_failure using message = 'scrapling_writer_run_already_leased';
  end if;
  select * into strict saved from public.scrapling_collection_runs where id=p_run_id;
  return jsonb_build_object('run_id',saved.id,'writer_execution_id',saved.writer_execution_id,'writer_status',saved.writer_status);
end;
$$;

-- The standard ingest RPC creates draft_jobs immediately. Scrapling records
-- must remain in the shared source pool until Codex has recorded an accepted
-- filter decision. The existing retention RPC can then create the job.
create function private.guard_scrapling_draft_job()
returns trigger language plpgsql security invoker
set search_path = pg_catalog, public, pg_temp as $$
begin
  if exists(select 1 from public.source_items i
      where i.id=new.source_item_id and i.metadata->>'collector'='scrapling-separate-v1')
    and not exists(select 1 from public.scrapling_filter_decisions d
      where d.source_item_revision_id=new.source_item_revision_id
        and d.source_item_id=new.source_item_id and d.decision='accepted') then
    return null;
  end if;
  return new;
end;
$$;
revoke all on function private.guard_scrapling_draft_job() from public,anon,authenticated,service_role;
create trigger guard_scrapling_draft_until_filtered
before insert or update on public.draft_jobs
for each row execute function private.guard_scrapling_draft_job();

create function public.record_scrapling_filter_decision(
  p_run_id uuid,
  p_source_item_id uuid,
  p_source_item_revision_id uuid,
  p_input_hash text,
  p_decision text,
  p_matched_source_item_id uuid,
  p_matched_report_id uuid,
  p_match_method text,
  p_reason text,
  p_filter_version text,
  p_metadata jsonb default '{}'::jsonb
) returns jsonb
language plpgsql security invoker
set search_path = pg_catalog, public, pg_temp as $$
declare item public.source_items; revision public.source_item_revisions;
  saved public.scrapling_filter_decisions; retained jsonb;
begin
  if p_decision is null or p_decision not in ('accepted','exact_duplicate','same_event_duplicate','irrelevant','needs_review','source_held')
    or nullif(btrim(p_reason),'') is null or length(p_reason)>2000
    or nullif(btrim(p_filter_version),'') is null or length(p_filter_version)>80
    or jsonb_typeof(coalesce(p_metadata,'{}'::jsonb)) is distinct from 'object'
    or (p_decision in ('exact_duplicate','same_event_duplicate') and p_matched_source_item_id is null and p_matched_report_id is null)
    or (p_decision='accepted' and (p_matched_source_item_id is not null or p_matched_report_id is not null)) then
    raise invalid_parameter_value using message = 'scrapling_filter_decision_invalid';
  end if;
  if not exists(select 1 from public.scrapling_collection_runs where id=p_run_id) then
    raise foreign_key_violation using message = 'scrapling_collection_run_missing';
  end if;
  select * into strict item from public.source_items where id=p_source_item_id for update;
  select * into strict revision from public.source_item_revisions where id=p_source_item_revision_id;
  if item.current_revision_id is distinct from revision.id
    or revision.source_item_id is distinct from item.id
    or revision.content_hash is distinct from p_input_hash
    or item.content_hash is distinct from p_input_hash
    or item.metadata->>'collector' is distinct from 'scrapling-separate-v1'
    or coalesce(revision.metadata->>'scrapling_run_id',item.metadata->>'scrapling_run_id') is distinct from p_run_id::text then
    raise invalid_parameter_value using message = 'scrapling_filter_input_revision_mismatch';
  end if;
  if exists(select 1 from public.reports where source_item_id=item.id) then
    raise invalid_parameter_value using message = 'existing_report_preserved';
  end if;
  insert into public.scrapling_filter_decisions
    (run_id,source_item_id,source_item_revision_id,input_hash,decision,
     matched_source_item_id,matched_report_id,match_method,reason,filter_version,metadata)
  values (p_run_id,item.id,revision.id,p_input_hash,p_decision,p_matched_source_item_id,
    p_matched_report_id,nullif(btrim(p_match_method),''),btrim(p_reason),btrim(p_filter_version),coalesce(p_metadata,'{}'::jsonb))
  on conflict (run_id,source_item_revision_id) do nothing
  returning * into saved;
  if saved.id is null then
    select * into strict saved from public.scrapling_filter_decisions
      where run_id=p_run_id and source_item_revision_id=revision.id;
    return jsonb_build_object('decision_id',saved.id,'decision',saved.decision,'status','already_recorded');
  end if;

  if p_decision='accepted' then
    update public.source_item_revisions set metadata=metadata||jsonb_build_object(
      'ai_ready',true,'scrapling_filter_decision_id',saved.id,'scrapling_filter_version',p_filter_version
    ) where id=revision.id;
    update public.source_items set relevance_status='relevant',metadata=metadata||jsonb_build_object(
      'ai_ready',true,'scrapling_filter_decision_id',saved.id,'scrapling_filter_version',p_filter_version
    ),updated_at=clock_timestamp() where id=item.id;
    retained=public.collector_retain_for_draft(item.id,revision.id,p_input_hash,
      'Scrapling candidate accepted after relevance and duplicate review: '||btrim(p_reason));
    return jsonb_build_object('decision_id',saved.id,'decision',p_decision,'status',retained->>'status',
      'job_id',retained->>'job_id','item_id',item.id,'revision_id',revision.id);
  elsif p_decision in ('exact_duplicate','same_event_duplicate','irrelevant') then
    update public.source_items set relevance_status='irrelevant',pipeline_status='ignored',
      metadata=metadata||jsonb_build_object('scrapling_filter_decision_id',saved.id,
        'scrapling_filter_status',p_decision,'scrapling_filter_reason',btrim(p_reason)),
      updated_at=clock_timestamp() where id=item.id;
  else
    update public.source_items set relevance_status='needs_review',
      metadata=metadata||jsonb_build_object('scrapling_filter_decision_id',saved.id,
        'scrapling_filter_status',p_decision,'scrapling_filter_reason',btrim(p_reason)),
      updated_at=clock_timestamp() where id=item.id;
  end if;
  return jsonb_build_object('decision_id',saved.id,'decision',p_decision,'status','recorded','item_id',item.id);
end;
$$;

revoke all on function public.record_scrapling_collection_run(uuid,text,date,date,timestamptz,timestamptz,text,text,jsonb),
  public.record_scrapling_writer_run(uuid,text,timestamptz,timestamptz,text,jsonb),
  public.record_scrapling_filter_decision(uuid,uuid,uuid,text,text,uuid,uuid,text,text,text,jsonb)
  from public,anon,authenticated;
grant execute on function public.record_scrapling_collection_run(uuid,text,date,date,timestamptz,timestamptz,text,text,jsonb),
  public.record_scrapling_writer_run(uuid,text,timestamptz,timestamptz,text,jsonb),
  public.record_scrapling_filter_decision(uuid,uuid,uuid,text,text,uuid,uuid,text,text,text,jsonb)
  to service_role;
