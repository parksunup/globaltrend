-- Editorial triage is shared by every collector. It records why a source item
-- enters (or leaves) the Korean drafting queue, without deleting source evidence.
create table public.trend_editorial_triage_decisions (
  id uuid primary key,
  source_item_id uuid not null references public.source_items(id) on delete restrict,
  source_item_revision_id uuid not null references public.source_item_revisions(id) on delete restrict,
  input_hash text not null check (input_hash ~ '^[0-9a-f]{64}$'),
  decision text not null check (decision in ('accepted','irrelevant','low_significance','needs_review')),
  reason text not null check (length(btrim(reason)) between 1 and 2000),
  decision_version text not null check (length(btrim(decision_version)) between 1 and 80),
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata)='object'),
  created_at timestamptz not null default clock_timestamp()
);
create index trend_editorial_triage_revision_idx
  on public.trend_editorial_triage_decisions(source_item_revision_id,created_at desc);
alter table public.trend_editorial_triage_decisions enable row level security;
revoke all on public.trend_editorial_triage_decisions from public,anon,authenticated;
grant select,insert on public.trend_editorial_triage_decisions to service_role;

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
    or length(btrim(revision.content_text)) < 10
    or length(revision.content_text) > 80000 then
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
    -- Readiness means there is usable source text. Relevance, importance,
    -- source approval, and publication date are separate decisions.
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

-- Only records that passed the cross-source relevance and significance triage
-- may be claimed for Korean drafting.
do $$
declare definition text; original text;
begin
  definition=pg_get_functiondef('public.claim_trend_draft_jobs(text,integer,uuid)'::regprocedure);
  original=definition;
  definition=replace(definition,
    'and s.is_active and s.terms_reviewed_at is not null and (r.metadata->>''ai_ready'' = ''true'' or si.published_at is null)',
    'and s.is_active and s.terms_reviewed_at is not null and si.relevance_status = ''relevant''');
  if definition=original or position('si.relevance_status = ''relevant''' in definition)=0 then
    raise exception 'draft claim triage gate definition changed; review required';
  end if;
  execute definition;
end $$;

-- Queue every already-stored PDPC item without a report for a single-item
-- re-fetch through the deployed current edge parser. Messages are staggered so
-- this recovery does not burst requests at the source.
create or replace function public.queue_pdpc_unwritten_item_rechecks()
returns jsonb
language plpgsql security definer
set search_path=pg_catalog,public,pgmq,pg_temp as $$
declare pdpc_id uuid; current_day date=(now() at time zone 'Asia/Seoul')::date;
  rec record; backlog_id uuid; ordinal integer=0; queued integer=0; held integer=0;
begin
  select id into strict pdpc_id from public.sources where name='Personal Data Protection Commission (Singapore)';
  if not public.collector_source_allowed(pdpc_id) then
    raise insufficient_privilege using message='pdpc_source_not_approved';
  end if;
  if not exists(select 1 from public.collector_edge_sources where source_id=pdpc_id and slug='pdpc') then
    raise invalid_parameter_value using message='pdpc_edge_source_not_registered';
  end if;
  if not (select enabled from public.collector_edge_control where singleton)
     or not (public.collector_capacity()->>'can_write')::boolean then
    raise object_not_in_prerequisite_state using message='pdpc_edge_collection_not_ready';
  end if;
  for rec in
    select si.id,si.canonical_url,si.title_original,si.published_at,
      r.metadata->'date_observations' as date_observations,
      r.metadata->>'topic' as topic
    from public.source_items si
    join public.source_item_revisions r on r.id=si.current_revision_id
    where si.source_id=pdpc_id
      and not exists(select 1 from public.reports rep where rep.source_item_id=si.id)
    order by si.created_at,si.id
  loop
    ordinal=ordinal+1;
    insert into public.collector_edge_backlog(source_id,url,range_start,range_end,state,retryable)
    values(pdpc_id,rec.canonical_url,coalesce(rec.published_at::date,'1900-01-01'::date),current_day,
      jsonb_build_object(
        'since',coalesce(rec.published_at::date,'1900-01-01'::date)::text,
        'until',current_day::text,
        'page','https://www.pdpc.gov.sg/api/listing-api?itemsperpage=10&listingtype=media_events&pathname=%2Fmedia-events',
        'offset',0,
        'rows',jsonb_build_array(jsonb_strip_nulls(jsonb_build_object(
          'url',rec.canonical_url,'title',rec.title_original,'topic',rec.topic,
          'date_observations',coalesce(rec.date_observations,'[]'::jsonb)
        ))),
        'is_backlog',true,
        'adapter_version','edge-v2',
        'failures',0,
        'recheck_reason','existing_pdpc_item_without_report'
      ),true)
    on conflict(source_id,url) where not resolved do nothing
    returning id into backlog_id;
    if backlog_id is null then
      held=held+1;
    else
      perform pgmq.send('trend_collect',jsonb_build_object(
        'source_id',pdpc_id,'kind','backlog-retry','backlog_id',backlog_id
      ),(ordinal-1)*60);
      queued=queued+1;
    end if;
    backlog_id=null;
  end loop;
  return jsonb_build_object('source_id',pdpc_id,'candidates',ordinal,'queued',queued,
    'already_open_or_held',held,'delay_seconds_between_items',60,'range_end',current_day);
end; $$;
revoke all on function public.queue_pdpc_unwritten_item_rechecks() from public,anon,authenticated;
grant execute on function public.queue_pdpc_unwritten_item_rechecks() to service_role;
