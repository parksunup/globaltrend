-- Make the production fan-out one-job-per-writer. Parallel writers claim in
-- their own execution context rather than receiving a coordinator's shared
-- multi-job packet. SKIP LOCKED in the underlying claim RPC gives each writer
-- a different job; this per-worker advisory lock prevents the same worker ID
-- from acquiring a second active lease through concurrent calls.
create or replace function public.collector_claim_retained_draft(p_worker text)
returns jsonb
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
begin
  if nullif(btrim(p_worker), '') is null or length(p_worker) > 160 then
    raise invalid_parameter_value using message = 'Unique writer ID is required';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended('retained-draft-worker:' || p_worker, 0)
  );

  if exists (
    select 1
    from public.draft_jobs j
    where j.status = 'claimed'
      and j.claimed_by = p_worker
      and j.lease_until > now()
  ) then
    return jsonb_build_object(
      'status', 'worker_already_has_active_job',
      'jobs', '[]'::jsonb
    );
  end if;

  return public.collector_claim_retained_drafts(p_worker, 1);
end;
$$;

revoke all on function public.collector_claim_retained_draft(text)
  from public, anon, authenticated, service_role;
grant execute on function public.collector_claim_retained_draft(text)
  to service_role;

-- Keep the retained-work counters aligned with current editorial exclusion
-- decisions and actual writer state. Earlier `keep` flags are historical; a
-- later low-significance, duplicate, irrelevant, or cancelled decision must
-- not remain in the active retained-work total.
create or replace function public.collector_retained_draft_status()
returns jsonb
language sql
stable
set search_path = public, pg_temp
as $function$
  with retained as (
    select i.id
    from public.source_items i
    where i.metadata->>'retention_decision' = 'keep'
      and i.relevance_status is distinct from 'irrelevant'
      and i.pipeline_status is distinct from 'ignored'
      and coalesce(i.metadata->'editorial_triage'->>'decision', '') not in (
        'low_significance', 'irrelevant', 'exact_duplicate', 'same_event_duplicate'
      )
      and (
        select j.status
        from public.draft_jobs j
        where j.source_item_id = i.id
        order by j.updated_at desc, j.id desc
        limit 1
      ) is distinct from 'cancelled'
  )
  select jsonb_build_object(
    'retained', count(*),
    'draft_stored', count(*) filter (where exists (
      select 1 from public.reports rp
      where rp.source_item_id = retained.id
        and nullif(trim(rp.title_ko), '') is not null
        and nullif(trim(rp.one_line_summary_ko), '') is not null
        and nullif(trim(rp.detailed_summary_ko), '') is not null
    )),
    'unfinished', count(*) filter (where not exists (
      select 1 from public.reports rp
      where rp.source_item_id = retained.id
        and nullif(trim(rp.title_ko), '') is not null
        and nullif(trim(rp.one_line_summary_ko), '') is not null
        and nullif(trim(rp.detailed_summary_ko), '') is not null
    ))
  )
  from retained;
$function$;

-- Daily completion must use the same active-retention definition. Otherwise
-- stale historical `keep` flags can keep a daily producer run partial after
-- editorial triage has already excluded those items.
create or replace function public.collector_daily_pipeline_status(
  p_since date,
  p_until date
) returns jsonb
language plpgsql
stable
set search_path = public, pg_temp
as $function$
declare
  gap_count integer;
  retained_unfinished integer;
  gaps jsonb;
begin
  if p_since is null or p_until is null or p_until < p_since
     or p_until - p_since > 14 then
    raise invalid_parameter_value using message='A bounded daily pipeline window is required';
  end if;

  select count(*),
         coalesce(
           jsonb_agg(
             jsonb_build_object(
               'item_id',g.item_id,
               'job_id',g.job_id,
               'job_status',g.job_status,
               'reason',g.reason
             )
             order by g.item_id
           ),
           '[]'::jsonb
         )
    into gap_count,gaps
    from public.collector_completion_gaps(p_since,p_until) g;

  select count(*)::integer
    into retained_unfinished
    from public.source_items i
   where i.metadata->>'retention_decision'='keep'
     and i.relevance_status is distinct from 'irrelevant'
     and i.pipeline_status is distinct from 'ignored'
     and coalesce(i.metadata->'editorial_triage'->>'decision', '') not in (
       'low_significance', 'irrelevant', 'exact_duplicate', 'same_event_duplicate'
     )
     and (
       select j.status
         from public.draft_jobs j
        where j.source_item_id=i.id
        order by j.updated_at desc,j.id desc
        limit 1
     ) is distinct from 'cancelled'
     and not exists(
       select 1
         from public.reports r
        where r.source_item_id=i.id
          and r.status in ('draft','in_review','approved','published')
          and nullif(btrim(r.title_ko),'') is not null
          and nullif(btrim(r.one_line_summary_ko),'') is not null
          and nullif(btrim(r.detailed_summary_ko),'') is not null
     );

  return jsonb_build_object(
    'since',p_since,
    'until',p_until,
    'completion_gap_count',gap_count,
    'retained_drafts_unfinished',retained_unfinished,
    'ready_to_complete',gap_count=0 and retained_unfinished=0,
    'gaps',gaps
  );
end;
$function$;

-- Reconcile the four historical rows whose later editorial decision had
-- already excluded them, while their old retention flag still said `keep`.
-- Match stable source URLs and prior decisions rather than generated row IDs.
with exclusions(canonical_url, previous_triage, corrected_triage, reason) as (
  values
    ('https://social.edps.europa.eu/@EDPS/117523506944514368', 'low_significance', null::text,
     '2026-11-16 review: a 2026 social post reintroduced the 2025 opinion and announced no new action.'),
    ('https://www.cac.gov.cn/2026-10/30/c_1795114304542687.htm', 'low_significance', null::text,
     '2026-11-16 review: the filing-list notice repeated existing registration duties and added no new privacy rule.'),
    ('https://overview.legal/posts/607721', 'needs_review', 'same_event_duplicate',
     '2026-11-16 review: C-484/24 NTH Haustechnik is already covered by the existing CJEU report; this is a duplicate source item.'),
    ('https://social.edps.europa.eu/@EDPS/117564708601113117', 'low_significance', null::text,
     '2026-11-16 review: the event post recapped existing human-oversight guidance and announced no new policy action.')
)
update public.source_items i
set relevance_status = 'irrelevant',
    pipeline_status = 'ignored',
    metadata = jsonb_set(
      (i.metadata || jsonb_build_object(
        'retention_previous_decision', i.metadata->>'retention_decision',
        'retention_previous_reason', i.metadata->'retention_reason',
        'retention_decision', 'exclude',
        'retention_exclusion_reason', e.reason,
        'retention_reconciled_at', clock_timestamp()
      )),
      '{editorial_triage}',
      case when e.corrected_triage is null then i.metadata->'editorial_triage'
        else (coalesce(i.metadata->'editorial_triage', '{}'::jsonb) || jsonb_build_object(
          'previous_decision', i.metadata->'editorial_triage'->>'decision',
          'previous_reason', i.metadata->'editorial_triage'->>'reason',
          'previous_decision_id', i.metadata->'editorial_triage'->>'decision_id',
          'decision', e.corrected_triage,
          'reason', e.reason,
          'version', 'trend-editorial-triage-v2'
        )) - 'decision_id'
      end,
      true
    ),
    updated_at = clock_timestamp()
from exclusions e
where i.canonical_url = e.canonical_url
  and i.metadata->>'retention_decision' = 'keep'
  and i.metadata->'editorial_triage'->>'decision' = e.previous_triage
  and i.relevance_status in ('irrelevant', 'needs_review')
  and i.pipeline_status = 'ignored'
  and not exists (select 1 from public.draft_jobs j where j.source_item_id = i.id)
  and not exists (select 1 from public.reports r where r.source_item_id = i.id);
