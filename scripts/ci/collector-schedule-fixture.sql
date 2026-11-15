-- CI only: the rescheduling migration expects a separately provisioned job.
-- The workflow copies this file into its disposable local migration directory.
-- Do not add it to deployment migrations or run it against a linked database.
do $$
declare
  v_job record;
  v_job_id bigint;
begin
  select jobid, command, active into v_job
  from cron.job where jobname = 'trend-collector-daily';

  if found then
    -- Local reset can retain extension data. Never overwrite an actual job.
    if v_job.command is distinct from 'SELECT 1' or v_job.active then
      raise exception 'CI fixture refuses to replace an existing collector job';
    end if;
    return;
  end if;

  v_job_id := cron.schedule('trend-collector-daily', '0 0 1 1 *', 'SELECT 1');
  perform cron.alter_job(job_id := v_job_id, active := false);
end;
$$;
