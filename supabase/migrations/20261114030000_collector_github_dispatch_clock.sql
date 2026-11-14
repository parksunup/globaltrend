-- GitHub schedule events have been arriving about five hours late. Keep the
-- Python workers on GitHub, but let the existing Supabase clock dispatch them.
create table private.collector_github_dispatches (
  local_day date not null,
  workflow text not null check (workflow in (
    'crawlee-daily-collector.yml',
    'scrapling-daily-collector.yml',
    'trend-cloud-python.yml'
  )),
  status text not null default 'ready' check (status in ('ready','pending','accepted','failed')),
  attempts integer not null default 0 check (attempts between 0 and 3),
  last_requested_at timestamptz,
  request_id bigint,
  github_run_id bigint,
  http_status integer,
  last_error text,
  primary key (local_day,workflow)
);
alter table private.collector_github_dispatches enable row level security;
revoke all on private.collector_github_dispatches from public,anon,authenticated,service_role;

create function private.collector_github_dispatch_tick(p_slot text, p_clock timestamptz default now())
returns integer language plpgsql security definer
set search_path=pg_catalog,private,pg_temp as $$
declare
  local_time timestamp := p_clock at time zone 'Asia/Seoul';
  wanted_hour integer;
  workflow_name text;
  row_state private.collector_github_dispatches;
  response_status integer;
  response_error text;
  response_body text;
  token_value text;
  new_request bigint;
  sent integer := 0;
begin
  if p_slot = '03' then wanted_hour := 3;
  elsif p_slot = '06' then wanted_hour := 6;
  else raise exception 'unknown collector slot';
  end if;
  -- A late cron invocation cannot silently initiate yesterday's collection.
  if extract(hour from local_time) <> wanted_hour then return 0; end if;

  for workflow_name in
    select unnest(case when p_slot = '03'
      then array['crawlee-daily-collector.yml','scrapling-daily-collector.yml']
      else array['trend-cloud-python.yml'] end)
  loop
    insert into private.collector_github_dispatches(local_day,workflow)
      values(local_time::date,workflow_name) on conflict do nothing;
    select * into strict row_state from private.collector_github_dispatches
      where local_day=local_time::date and workflow=workflow_name for update;
    if row_state.status='accepted' then continue; end if;

    if row_state.request_id is not null then
      select status_code,error_msg,content into response_status,response_error,response_body
        from net._http_response where id=row_state.request_id;
      if response_status in (200,204) then
        update private.collector_github_dispatches set
          status='accepted',http_status=response_status,last_error=null,
          github_run_id=case when response_status=200 and response_body is not null
            then nullif(response_body::jsonb->>'workflow_run_id','')::bigint else null end
          where local_day=local_time::date and workflow=workflow_name;
        continue;
      end if;
      if row_state.last_requested_at > clock_timestamp()-interval '4 minutes' then continue; end if;
      if response_status is not null or response_error is not null then
        update private.collector_github_dispatches set
          status='failed',http_status=response_status,
          last_error=left(coalesce(response_error,'HTTP '||response_status),200)
          where local_day=local_time::date and workflow=workflow_name;
      end if;
    end if;
    if row_state.attempts>=3 then
      update private.collector_github_dispatches set status='failed',
        last_error=coalesce(last_error,'GitHub dispatch response unavailable after 3 attempts')
        where local_day=local_time::date and workflow=workflow_name;
      continue;
    end if;

    select decrypted_secret into token_value from vault.decrypted_secrets
      where name='globaltrend_podcast_github_dispatch';
    if token_value is null or length(token_value)<20 then
      raise exception 'GitHub Actions dispatch credential missing';
    end if;
    select net.http_post(
      url:='https://api.github.com/repos/parksunup/globaltrend/actions/workflows/'||workflow_name||'/dispatches',
      headers:=jsonb_build_object('Authorization','Bearer '||token_value,
        'Accept','application/vnd.github+json',
        'X-GitHub-Api-Version','2026-03-10','Content-Type','application/json'),
      body:=case when workflow_name='crawlee-daily-collector.yml'
        then '{"ref":"main","inputs":{"actual_collection":"true"}}'::jsonb
        else '{"ref":"main"}'::jsonb end,
      timeout_milliseconds:=15000
    ) into new_request;
    update private.collector_github_dispatches set
      status='pending',attempts=attempts+1,last_requested_at=clock_timestamp(),
      request_id=new_request,http_status=null,last_error=null
      where local_day=local_time::date and workflow=workflow_name;
    sent := sent+1;
  end loop;
  return sent;
end; $$;
revoke all on function private.collector_github_dispatch_tick(text,timestamptz)
  from public,anon,authenticated,service_role;

-- The same slot runs briefly again to confirm GitHub's HTTP response and retry
-- a failed delivery. Accepted workflows are never dispatched twice that day.
select cron.schedule('collector-github-dispatch-03','*/5 18 * * *',
  'select private.collector_github_dispatch_tick(''03'');');
select cron.schedule('collector-github-dispatch-06','*/5 21 * * *',
  'select private.collector_github_dispatch_tick(''06'');');
