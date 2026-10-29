-- An administrator can replace only the dedicated NotebookLM session.
-- Bootstrap credentials are encrypted by Vault; no client can read them back.
create table private.podcast_reconnect_state (
 id boolean primary key default true check(id),
 available boolean not null default false,
 secret_id uuid,
 requested_at timestamptz,
 requested_by uuid,
 verified_at timestamptz,
 result text not null default 'idle' check(result in ('idle','pending','verified','failed'))
);
insert into private.podcast_reconnect_state(id) values(true);
alter table private.podcast_reconnect_state enable row level security;
revoke all on private.podcast_reconnect_state from public,anon,authenticated,service_role;

create function public.podcast_reconnect_status() returns jsonb
language plpgsql security definer set search_path=pg_catalog,private,pg_temp as $$
declare r private.podcast_reconnect_state;
begin
 if not exists(select 1 from public.team_memberships where user_id=auth.uid() and is_active and role='admin') then raise exception 'administrator only' using errcode='42501'; end if;
 select * into strict r from private.podcast_reconnect_state where id;
 return jsonb_build_object('available',r.available,'result',r.result,'requestedAt',r.requested_at,'verifiedAt',r.verified_at);
end; $$;
revoke all on function public.podcast_reconnect_status() from public,anon;
grant execute on function public.podcast_reconnect_status() to authenticated;

create function public.queue_podcast_reconnect(p_storage jsonb) returns jsonb
language plpgsql security definer set search_path=pg_catalog,private,pg_temp as $$
declare r private.podcast_reconnect_state; s private.podcast_session_state; h uuid;
begin
 if not exists(select 1 from public.team_memberships where user_id=auth.uid() and is_active and role='admin') then raise exception 'administrator only' using errcode='42501'; end if;
 select * into strict s from private.podcast_session_state where id for update;
 select * into strict r from private.podcast_reconnect_state where id for update;
 if not r.available then raise exception 'reconnection rollout pending'; end if;
 if s.lease_until>now() or r.requested_at>now()-interval '2 minutes' then raise exception 'reconnection busy'; end if;
 if p_storage is null or octet_length(p_storage::text)>131072
  or p_storage#>>'{notebooklm,account,email}' is distinct from 'psunup@gmail.com'
  or jsonb_typeof(p_storage->'cookies') is distinct from 'array' then raise exception 'invalid dedicated session'; end if;
 if not exists(select 1 from jsonb_array_elements(p_storage->'cookies') c where c->>'name'='SID' and length(c->>'value')>0)
  or not exists(select 1 from jsonb_array_elements(p_storage->'cookies') c where c->>'name'='__Secure-1PSIDTS' and length(c->>'value')>0) then raise exception 'incomplete dedicated session'; end if;
 if exists(select 1 from jsonb_array_elements(p_storage->'cookies') c where coalesce(c->>'domain','') not in ('.google.com','google.com','notebooklm.google.com','notebook.google.com') or coalesce(c->>'path','')<>'/') then raise exception 'invalid cookie scope'; end if;
 if r.secret_id is not null then delete from vault.secrets where id=r.secret_id; end if;
 select vault.create_secret(p_storage::text) into h;
 update private.podcast_reconnect_state set secret_id=h,requested_at=now(),requested_by=auth.uid(),result='pending' where id;
 update private.podcast_session_state set enabled=true,test_until=null,consecutive_failures=0,last_failure=null where id;
 update private.podcast_dispatch_state set enabled=true where id;
 -- The fixed dispatcher retains its lease and rate limits; never accepts a URL or token from the browser.
 perform private.podcast_dispatch_tick();
 return jsonb_build_object('ok',true,'result','pending');
end; $$;
revoke all on function public.queue_podcast_reconnect(jsonb) from public,anon;
grant execute on function public.queue_podcast_reconnect(jsonb) to authenticated;

create function private.podcast_reconnect_lease(p_run text) returns jsonb
language plpgsql security definer set search_path=pg_catalog,private,pg_temp as $$
declare r private.podcast_reconnect_state; payload jsonb;
begin
 if coalesce(auth.role(),'')<>'service_role' or not exists(select 1 from private.podcast_session_state where id and lease_run=p_run and lease_until>now()) then raise exception 'worker lease required' using errcode='42501'; end if;
 select * into strict r from private.podcast_reconnect_state where id for update;
 if r.secret_id is null then return null; end if;
 if r.requested_at<now()-interval '15 minutes' then
  delete from vault.secrets where id=r.secret_id;
  update private.podcast_reconnect_state set secret_id=null,result='failed' where id;
  return null;
 end if;
 select decrypted_secret::jsonb into payload from vault.decrypted_secrets where id=r.secret_id;
 return payload;
end; $$;
revoke all on function private.podcast_reconnect_lease(text) from public,anon,authenticated;
grant execute on function private.podcast_reconnect_lease(text) to service_role;

create function private.podcast_reconnect_finish(p_run text,p_ok boolean) returns void
language plpgsql security definer set search_path=pg_catalog,private,pg_temp as $$
declare r private.podcast_reconnect_state;
begin
 if coalesce(auth.role(),'')<>'service_role' or not exists(select 1 from private.podcast_session_state where id and lease_run=p_run and lease_until>now()) then raise exception 'worker lease required' using errcode='42501'; end if;
 select * into strict r from private.podcast_reconnect_state where id for update;
 if r.secret_id is null then return; end if;
 delete from vault.secrets where id=r.secret_id;
 update private.podcast_reconnect_state set secret_id=null,result=case when p_ok then 'verified' else 'failed' end,verified_at=case when p_ok then now() else verified_at end where id;
end; $$;
revoke all on function private.podcast_reconnect_finish(text,boolean) from public,anon,authenticated;
grant execute on function private.podcast_reconnect_finish(text,boolean) to service_role;

create or replace function public.podcast_session_step(p_run text,p_action text,p_data jsonb default '{}')
returns jsonb language plpgsql security invoker set search_path=pg_catalog,private,pg_temp as $$
declare s private.podcast_session_state; e jsonb; failure text; recovery jsonb;
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
    recovery=private.podcast_reconnect_lease(p_run);
    return jsonb_build_object('version',s.version,'envelope',s.envelope,'recovery',recovery,'auth_only',recovery is not null or s.test_until is not null);
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
       or length(coalesce(e->>'ciphertext','')) not between 64 and 180000
       or coalesce(e->>'ciphertext','') !~ '^[A-Za-z0-9+/=]+$'
       or (s.envelope is not null and e->>'key_id' is distinct from s.envelope->>'key_id') then
      raise exception 'invalid encrypted session';
    end if;
    perform private.podcast_reconnect_finish(p_run,true);
    update private.podcast_session_state set envelope=e,version=version+1,last_verified_at=now(),
      lease_run=null,lease_until=null,consecutive_failures=0,last_failure=null where id;
    insert into private.podcast_session_checks(run_id,version,result) values(p_run,s.version+1,'verified') on conflict do nothing;
    delete from private.podcast_session_checks where checked_at < now()-interval '10 days';
    return jsonb_build_object('version',s.version+1);
  elsif p_action='fail' then
    failure=p_data->>'category';
    if failure is null or failure not in ('auth','transport','storage','invalid_state') then raise exception 'invalid failure'; end if;
    if failure='auth' or s.consecutive_failures>=2 then perform private.podcast_reconnect_finish(p_run,false); end if;
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

