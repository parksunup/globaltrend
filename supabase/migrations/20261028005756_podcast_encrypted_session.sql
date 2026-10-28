-- Ciphertext only. The AES key stays in GitHub Secrets, never Postgres.
create table private.podcast_session_state (
  id boolean primary key default true check (id),
  enabled boolean not null default false,
  test_until timestamptz,
  envelope jsonb,
  version bigint not null default 0 check (version >= 0),
  lease_run text,
  lease_until timestamptz,
  last_verified_at timestamptz,
  consecutive_failures integer not null default 0,
  last_failure text check (last_failure in ('auth','transport','storage','invalid_state'))
);
insert into private.podcast_session_state(id) values (true);
create table private.podcast_session_checks (
  run_id text primary key,
  checked_at timestamptz not null default now(),
  version bigint not null,
  result text not null check (result in ('verified','auth','transport','storage','invalid_state'))
);
create index podcast_session_checks_time on private.podcast_session_checks(checked_at);
alter table private.podcast_session_state enable row level security;
alter table private.podcast_session_checks enable row level security;
revoke all on private.podcast_session_state, private.podcast_session_checks from public,anon,authenticated,service_role;
grant usage on schema private to service_role;
grant select,update on private.podcast_session_state to service_role;
grant select,insert,delete on private.podcast_session_checks to service_role;

create function public.podcast_session_step(p_run text,p_action text,p_data jsonb default '{}')
returns jsonb language plpgsql security invoker set search_path=pg_catalog,private,pg_temp as $$
declare s private.podcast_session_state; e jsonb; failure text;
begin
  if coalesce(auth.role(),'') <> 'service_role' then
    raise exception 'worker only' using errcode='42501';
  end if;
  if p_run !~ '^[0-9]+:[0-9]+$' then raise exception 'invalid run'; end if;
  select * into strict s from private.podcast_session_state where id for update;
  if p_action='acquire' then
    if not s.enabled then return null; end if;
    if s.test_until is not null and s.test_until <= now() then
      update private.podcast_session_state set enabled=false where id;
      return null;
    end if;
    if s.lease_until > now() and s.lease_run is distinct from p_run then return null; end if;
    update private.podcast_session_state set lease_run=p_run,lease_until=now()+interval '15 minutes' where id;
    return jsonb_build_object('version',s.version,'envelope',s.envelope,'auth_only',s.test_until is not null);
  end if;
  if s.lease_run is distinct from p_run or s.lease_until is null or s.lease_until <= now() then
    raise exception 'session lease lost';
  end if;
  if p_action='save' then
    if coalesce(p_data->>'version','') !~ '^[0-9]+$' or (p_data->>'version')::bigint <> s.version then
      raise exception 'session version changed';
    end if;
    e=p_data->'envelope';
    if jsonb_typeof(e) is distinct from 'object' or octet_length(e::text)>190000
       or e - 'format' - 'key_id' - 'nonce' - 'ciphertext' <> '{}'::jsonb
       or e->>'format' is distinct from '1'
       or coalesce(e->>'key_id','') !~ '^[a-f0-9]{16}$'
       or coalesce(e->>'nonce','') !~ '^[A-Za-z0-9+/]{16}$'
       or coalesce(e->>'ciphertext','') !~ '^[A-Za-z0-9+/=]{64,180000}$'
       or (s.envelope is not null and e->>'key_id' is distinct from s.envelope->>'key_id') then
      raise exception 'invalid encrypted session';
    end if;
    update private.podcast_session_state set envelope=e,version=version+1,last_verified_at=now(),
      lease_run=null,lease_until=null,consecutive_failures=0,last_failure=null where id;
    insert into private.podcast_session_checks(run_id,version,result) values(p_run,s.version+1,'verified') on conflict do nothing;
    delete from private.podcast_session_checks where checked_at < now()-interval '10 days';
    return jsonb_build_object('version',s.version+1);
  elsif p_action='fail' then
    failure=p_data->>'category';
    if failure is null or failure not in ('auth','transport','storage','invalid_state') then raise exception 'invalid failure'; end if;
    update private.podcast_session_state set lease_run=null,lease_until=null,
      consecutive_failures=consecutive_failures+1,last_failure=failure,
      enabled=enabled and consecutive_failures < 2 where id;
    insert into private.podcast_session_checks(run_id,version,result) values(p_run,s.version,failure) on conflict do nothing;
    return jsonb_build_object('ok',true);
  end if;
  raise exception 'invalid session action';
end;
$$;
revoke all on function public.podcast_session_step(text,text,jsonb) from public,anon,authenticated;
grant execute on function public.podcast_session_step(text,text,jsonb) to service_role;
