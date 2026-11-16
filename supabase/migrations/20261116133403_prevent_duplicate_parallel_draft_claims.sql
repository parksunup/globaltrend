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
