-- Collect at 04:00 KST (19:00 UTC) so the 07:00 KST writer sees the completed Edge batch.
do $$
declare
  v_job_id bigint;
begin
  select jobid into v_job_id
  from cron.job
  where jobname = 'trend-collector-daily';

  if v_job_id is null then
    raise exception 'trend-collector-daily cron job is missing';
  end if;

  perform cron.alter_job(job_id := v_job_id, schedule := '0 19 * * *');
end;
$$;
