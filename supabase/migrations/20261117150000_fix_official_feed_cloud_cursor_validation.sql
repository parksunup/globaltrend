-- The EC News feed and its frozen page are official cloud-Python routes.
-- Accept their real cursor host and give the frozen official-feed snapshots
-- enough space while keeping every other source on the original 4 KB bound.
do $cloud_cursor$
declare
  definition text;
  old_branch text;
  new_branch text;
  old_limit text := 'octet_length(c::text)>4000';
  new_limit text := 'octet_length(c::text)>case when slug in (''ec'',''ec-news'',''eu-parliament'') then 50000 else 4000 end';
  n integer;
begin
  definition=pg_get_functiondef('private.collector_cloud_cursor_valid(jsonb,text)'::regprocedure);
  old_branch=$old$when slug='ec' then '^https://ec[.]europa[.]eu/commission/presscorner/'$old$;
  new_branch=$new$when slug='ec' then '^https://ec[.]europa[.]eu/commission/presscorner/' when slug='ec-news' then '^https://commission[.]europa[.]eu/'$new$;
  n=(length(definition)-length(replace(definition,old_branch,'')))/length(old_branch);
  if n<>1 then raise exception 'cloud cursor host guard drift: expected one EC branch, found %',n; end if;
  definition=replace(definition,old_branch,new_branch);
  n=(length(definition)-length(replace(definition,old_limit,'')))/length(old_limit);
  if n=1 then
    definition=replace(definition,old_limit,new_limit);
  elsif definition ~ 'octet_length\(c::text\)\s*>' then
    raise exception 'cloud cursor size guard drift: unexpected base cursor limit';
  end if;
  execute definition;

  definition=pg_get_functiondef('private.collector_cloud_frozen_cursor_valid(jsonb,text)'::regprocedure);
  n=(length(definition)-length(replace(definition,old_limit,'')))/length(old_limit);
  if n=1 then
    definition=replace(definition,old_limit,new_limit);
  elsif definition ~ 'octet_length\(c::text\)\s*>' then
    raise exception 'frozen cursor size guard drift: unexpected size limit';
  end if;
  execute definition;
end;
$cloud_cursor$;

-- Supabase owns the daily enqueue clock; GitHub Actions runs the Crawlee/Python
-- collectors afterward. Restore the provisioned enqueue schedule if it exists.
do $daily_enqueue$
declare v_job record;
begin
  select jobid,command,active into v_job
    from cron.job where jobname='trend-collector-daily';
  if found then
    if v_job.command='select public.collector_edge_enqueue(''daily-cron'');' then
      perform cron.alter_job(job_id := v_job.jobid, schedule := '0 19 * * *', active := true);
    else
      -- Keep isolated test fixtures disabled; only re-enable the known
      -- production enqueue command, never an arbitrary job with this name.
      perform cron.alter_job(job_id := v_job.jobid, schedule := '0 19 * * *', active := v_job.active);
    end if;
  end if;
end;
$daily_enqueue$;
