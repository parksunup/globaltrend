-- Collect at 04:00 KST (19:00 UTC) so the 07:00 KST writer sees the completed Edge batch.
do $$
declare
  v_job_id bigint;
begin
  select jobid into v_job_id
  from cron.job
  where jobname = 'trend-collector-daily';

  if v_job_id is null then
    -- Local migration replay does not provision the externally managed Edge
    -- cron job. Keep replayable schema changes independent from that setup;
    -- emit a visible warning so a deployment can provision/check the schedule.
    raise warning 'trend-collector-daily cron job is not provisioned; expected schedule remains 04:00 KST (0 19 * * *)';
  else
    perform cron.alter_job(job_id := v_job_id, schedule := '0 19 * * *');
  end if;
end;
$$;
