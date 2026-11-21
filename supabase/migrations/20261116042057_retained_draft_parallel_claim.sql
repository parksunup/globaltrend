-- Claim retained Korean-draft work in one atomic batch so independent writers
-- can process separate jobs concurrently. Each job still passes through the
-- existing claim_trend_draft_jobs policy, revision checks, retry schedule,
-- storage guard, and lease contract.
create or replace function public.collector_claim_retained_drafts(
  p_worker text,
  p_limit integer default 3
) returns jsonb
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
declare
  target uuid;
  seen_ids uuid[] := '{}'::uuid[];
  claimed_jobs jsonb := '[]'::jsonb;
  claim_packet jsonb;
  candidate_seen boolean := false;
begin
  if nullif(btrim(p_worker), '') is null or length(p_worker) > 160
     or p_limit is null or p_limit not between 1 and 10 then
    raise invalid_parameter_value using message = 'Bounded worker and batch are required';
  end if;

  loop
    exit when jsonb_array_length(claimed_jobs) >= p_limit;

    select j.id into target
    from public.draft_jobs j
    join public.source_items i on i.id = j.source_item_id
    where i.metadata->>'retention_decision' = 'keep'
      and i.relevance_status = 'relevant'
      and j.source_item_revision_id = i.current_revision_id
      and not exists (select 1 from public.reports r where r.source_item_id = i.id)
      and (j.status = 'pending'
        or (j.status = 'failed' and j.updated_at <= now() - interval '1 hour')
        or (j.status = 'claimed' and j.lease_until < now()))
      and not (j.id = any(seen_ids))
    order by j.created_at, j.id
    limit 1
    for update of j skip locked;

    exit when target is null;
    candidate_seen := true;
    seen_ids := array_append(seen_ids, target);

    -- Keep the existing generic claim RPC as the single source of truth for
    -- all writer eligibility, lease creation, and packet fields. If a retained
    -- row fails those checks, continue to the next one without losing the slot.
    select public.claim_trend_draft_jobs(p_worker, 1, target) into claim_packet;
    if jsonb_typeof(claim_packet) = 'array' and jsonb_array_length(claim_packet) = 1 then
      claimed_jobs := claimed_jobs || claim_packet;
    end if;
  end loop;

  return jsonb_build_object(
    'status', case
      when jsonb_array_length(claimed_jobs) > 0 then 'claimed'
      when candidate_seen then 'blocked_or_leased'
      else 'no_claimable_retained_job'
    end,
    'jobs', claimed_jobs
  );
end;
$$;

create or replace function public.collector_claim_retained_draft(p_worker text)
returns jsonb
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
declare result jsonb;
begin
  result := public.collector_claim_retained_drafts(p_worker, 1);
  return result;
end;
$$;

revoke all on function public.collector_claim_retained_drafts(text, integer)
  from public, anon, authenticated, service_role;
revoke all on function public.collector_claim_retained_draft(text)
  from public, anon, authenticated, service_role;
grant execute on function public.collector_claim_retained_drafts(text, integer)
  to service_role;
grant execute on function public.collector_claim_retained_draft(text)
  to service_role;
