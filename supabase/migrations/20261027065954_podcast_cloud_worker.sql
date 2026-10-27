-- Applied migration version matches the connected project's history.
-- Existing browser jobs remain unchanged. No Google credentials live in Postgres.
alter table public.podcast_production_jobs
  add column execution_mode text not null default 'browser' check (execution_mode in ('browser','cloud')),
  add column cloud_checkpoint jsonb not null default '{}'::jsonb,
  add column cloud_run text,
  add column cloud_lease_until timestamptz;

create table public.podcast_cloud_runtime (
  id boolean primary key default true check (id),
  enabled boolean not null default false,
  last_seen_at timestamptz,
  status text not null default 'setup_required' check (status in ('setup_required','ready','needs_login'))
);
insert into public.podcast_cloud_runtime(id) values(true);
alter table public.podcast_cloud_runtime enable row level security;
revoke all on public.podcast_cloud_runtime from public,anon,authenticated;
grant select on public.podcast_cloud_runtime to authenticated;
create policy "admins read podcast cloud status" on public.podcast_cloud_runtime
  for select to authenticated using(private.is_team_member('admin'));
grant all on public.podcast_cloud_runtime, public.podcast_production_jobs to service_role;
-- Keep existing administrator/snapshot checks; grant only the functions used
-- in this invoker chain, not anonymous or browser access.
grant usage on schema private to service_role;
grant execute on function private.is_team_member(text) to service_role;
grant execute on function public.publish_podcast_production_job(uuid) to service_role;
grant execute on function public.publish_weekly_podcast_issue(text,text,text,date,date,uuid[],text,text,bigint) to service_role;

-- One lease spans short polling runs. Expired leases may resume only from saved IDs.
-- Mutations with an uncertain outcome are blocked rather than duplicated.
create function public.podcast_cloud_step(p_run text, p_action text, p_job_id uuid default null, p_data jsonb default '{}')
returns jsonb language plpgsql security invoker set search_path=public,pg_temp as $$
declare j public.podcast_production_jobs; c jsonb;
begin
  if coalesce(auth.role(),'') <> 'service_role' then raise exception 'worker only' using errcode='42501'; end if;
  if p_run !~ '^[0-9]+:[0-9]+$' then raise exception 'invalid run'; end if;
  if p_action = 'health' then
    update public.podcast_cloud_runtime set last_seen_at=now(), status=case when p_data->>'ok'='true' then 'ready' else 'needs_login' end where id;
    return jsonb_build_object('ok',true);
  end if;
  if not exists(select 1 from public.podcast_cloud_runtime where id and enabled and status='ready') then
    raise exception 'cloud worker not enabled';
  end if;
  if p_action='claim' then
    select * into j from public.podcast_production_jobs
      where execution_mode='cloud' and phase in ('queued','opening','adding_sources','generating','collecting','uploading')
      and (cloud_lease_until is null or cloud_lease_until < now() or cloud_run=p_run)
      order by created_at limit 1 for update skip locked;
    if not found then return null; end if;
    if j.cloud_checkpoint->>'stage' in ('creating_notebook','adding_source','requesting_audio') then
      update public.podcast_production_jobs set phase='blocked',message='외부 요청의 완료 여부를 확인해야 합니다. NotebookLM에서 확인 후 이어가 주세요.',updated_at=now() where id=j.id;
      return null;
    end if;
    update public.podcast_production_jobs set cloud_run=p_run, cloud_lease_until=now()+interval '10 minutes',updated_at=now() where id=j.id returning * into j;
    return to_jsonb(j);
  end if;
  select * into strict j from public.podcast_production_jobs where id=p_job_id for update;
  if j.execution_mode<>'cloud' or j.cloud_run is distinct from p_run or j.cloud_lease_until < now()
     or j.phase in ('ready','cancelled','published') then raise exception 'lease lost'; end if;
  if p_action='inspect' then return to_jsonb(j);
  elsif p_action='checkpoint' then
    c=p_data->'checkpoint';
    if jsonb_typeof(c)<>'object' or octet_length(c::text)>4096 or p_data->>'phase' not in ('opening','adding_sources','generating','collecting','uploading','needs_login','blocked','failed') then raise exception 'invalid checkpoint'; end if;
    update public.podcast_production_jobs set cloud_checkpoint=c,phase=p_data->>'phase',
      notebook_url=case when c->>'notebook_id' ~ '^[a-f0-9-]{36}$' then 'https://notebooklm.google.com/notebook/'||(c->>'notebook_id') else notebook_url end,
      message=left(coalesce(p_data->>'message',''),500),cloud_lease_until=now()+interval '10 minutes',updated_at=now() where id=j.id returning * into j;
    return to_jsonb(j);
  elsif p_action='release' then
    update public.podcast_production_jobs set cloud_lease_until=now(),updated_at=now() where id=j.id;
    return jsonb_build_object('ok',true);
  elsif p_action='complete' then
    if p_data->>'mime' not in ('audio/mpeg','audio/mp4','audio/wav','audio/x-m4a') or (p_data->>'size')::bigint not between 1 and 52428800 then raise exception 'invalid audio'; end if;
    update public.podcast_production_jobs set phase='ready',audio_path=p_data->>'path',audio_mime_type=p_data->>'mime',file_size_bytes=(p_data->>'size')::bigint,
      message='',cloud_lease_until=null,updated_at=now() where id=j.id returning * into j;
    -- Publish using the requesting administrator's existing, snapshot-checked RPC.
    -- No arbitrary user ID is accepted from the worker, and no credentials are minted.
    if j.auto_publish then
      perform set_config('request.jwt.claims',jsonb_build_object('sub',j.created_by,'role','authenticated')::text,true);
      perform public.publish_podcast_production_job(j.id);
      perform set_config('request.jwt.claims','{"role":"service_role"}',true);
    end if;
    return jsonb_build_object('ok',true,'published',j.auto_publish);
  end if;
  raise exception 'invalid action';
end;
$$;
revoke all on function public.podcast_cloud_step(text,text,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.podcast_cloud_step(text,text,uuid,jsonb) to service_role;

create function public.podcast_cloud_storage_allowed(p_size bigint) returns boolean
language sql security invoker set search_path=public,pg_temp as $$
  select coalesce(auth.role(),'')='service_role' and p_size between 1 and 52428800
    and coalesce((select sum((metadata->>'size')::bigint) from storage.objects where bucket_id='weekly-podcasts'),0)+p_size <= 209715200;
$$;
revoke all on function public.podcast_cloud_storage_allowed(bigint) from public,anon,authenticated;
grant execute on function public.podcast_cloud_storage_allowed(bigint) to service_role;
