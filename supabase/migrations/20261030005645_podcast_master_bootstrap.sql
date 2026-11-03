-- One-time, administrator initiated exchange on the GitHub runner. The
-- institution's browser never connects to Google's Android auth endpoint.
-- The short-lived oauth_token lives in Vault only until one leased attempt.
alter table private.podcast_session_state add column master_envelope jsonb;

create table private.podcast_master_bootstrap_state (
 id boolean primary key default true check(id),
 secret_id uuid,
 requested_at timestamptz,
 requested_by uuid,
 lease_run text,
 lease_until timestamptz,
 result text not null default 'idle' check(result in ('idle','pending','verified','failed')),
 verified_at timestamptz,
 last_error text check(last_error in ('auth','network','invalid','unknown'))
);
insert into private.podcast_master_bootstrap_state(id) values(true);
alter table private.podcast_master_bootstrap_state enable row level security;
revoke all on private.podcast_master_bootstrap_state from public,anon,authenticated,service_role;

create function public.podcast_master_bootstrap_status() returns jsonb
language plpgsql security definer set search_path=pg_catalog,private,pg_temp as $$
declare b private.podcast_master_bootstrap_state;
begin
 if not exists(select 1 from public.team_memberships where user_id=auth.uid() and is_active and role='admin') then raise exception 'administrator only' using errcode='42501'; end if;
 select * into strict b from private.podcast_master_bootstrap_state where id;
 if b.result='pending' and b.requested_at<now()-interval '20 minutes' then
   if b.secret_id is not null then delete from vault.secrets where id=b.secret_id; end if;
   update private.podcast_master_bootstrap_state set secret_id=null,lease_run=null,lease_until=null,result='failed',last_error='auth' where id;
   b.result='failed';b.last_error='auth';
 end if;
 return jsonb_build_object('result',b.result,'requestedAt',b.requested_at,'verifiedAt',b.verified_at,'lastError',b.last_error);
end; $$;
revoke all on function public.podcast_master_bootstrap_status() from public,anon;
grant execute on function public.podcast_master_bootstrap_status() to authenticated;

create function public.queue_podcast_master_bootstrap(p_token text) returns jsonb
language plpgsql security definer set search_path=pg_catalog,private,pg_temp as $$
declare b private.podcast_master_bootstrap_state; h uuid; k text; request_id bigint;
begin
 if not exists(select 1 from public.team_memberships where user_id=auth.uid() and is_active and role='admin') then raise exception 'administrator only' using errcode='42501'; end if;
 if p_token is null or length(p_token) not between 20 and 4096 or p_token !~ '^[[:graph:]]+$' then raise exception 'invalid one-time token'; end if;
 select * into strict b from private.podcast_master_bootstrap_state where id for update;
 if b.requested_at>now()-interval '2 minutes' or b.lease_until>now() then raise exception 'bootstrap busy'; end if;
 if b.secret_id is not null then delete from vault.secrets where id=b.secret_id; end if;
 select vault.create_secret(p_token) into h;
 update private.podcast_master_bootstrap_state set secret_id=h,requested_at=now(),requested_by=auth.uid(),lease_run=null,lease_until=null,result='pending',last_error=null where id;
 select decrypted_secret into k from vault.decrypted_secrets where name='globaltrend_podcast_github_dispatch';
 if k is null or length(k)<20 then raise exception 'podcast dispatch credential missing'; end if;
 -- Fixed workflow and ref. The administrator cannot supply a URL or token.
 select net.http_post(
   url:='https://api.github.com/repos/parksunup/globaltrend/actions/workflows/podcast-master-bootstrap.yml/dispatches',
   headers:=jsonb_build_object('Authorization','Bearer '||k,'Accept','application/vnd.github+json','X-GitHub-Api-Version','2026-03-10','Content-Type','application/json'),
   body:='{"ref":"main"}'::jsonb,timeout_milliseconds:=15000) into request_id;
 return jsonb_build_object('ok',true,'result','pending');
end; $$;
revoke all on function public.queue_podcast_master_bootstrap(text) from public,anon;
grant execute on function public.queue_podcast_master_bootstrap(text) to authenticated;

create function private.podcast_bootstrap_envelope_valid(e jsonb,max_bytes integer) returns boolean
language sql immutable set search_path=pg_catalog,pg_temp as $$
 select jsonb_typeof(e)='object' and e - 'format' - 'key_id' - 'nonce' - 'ciphertext'='{}'::jsonb
  and e->>'format'='1' and coalesce(e->>'key_id','') ~ '^[a-f0-9]{16}$'
  and coalesce(e->>'nonce','') ~ '^[A-Za-z0-9+/]{16}$'
  and length(coalesce(e->>'ciphertext','')) between 64 and max_bytes
  and coalesce(e->>'ciphertext','') ~ '^[A-Za-z0-9+/=]+$';
$$;
revoke all on function private.podcast_bootstrap_envelope_valid(jsonb,integer) from public,anon,authenticated;

create function public.podcast_master_bootstrap_step(p_run text,p_action text,p_data jsonb default '{}') returns jsonb
language plpgsql security definer set search_path=pg_catalog,private,pg_temp as $$
declare b private.podcast_master_bootstrap_state; s private.podcast_session_state; token text; master jsonb; session_data jsonb;
begin
 if coalesce(auth.role(),'')<>'service_role' then raise exception 'worker only' using errcode='42501'; end if;
 if p_run !~ '^[0-9]+:[0-9]+$' then raise exception 'invalid run'; end if;
 if p_action='read' then
   select * into strict s from private.podcast_session_state where id;
   if s.lease_run is distinct from p_run or s.lease_until<=now() then raise exception 'session lease required'; end if;
   return jsonb_build_object('envelope',s.master_envelope);
 end if;
 select * into strict b from private.podcast_master_bootstrap_state where id for update;
 if p_action='acquire' then
   if b.result<>'pending' or b.secret_id is null then return null; end if;
   if b.requested_at<now()-interval '15 minutes' then
     delete from vault.secrets where id=b.secret_id;
     update private.podcast_master_bootstrap_state set secret_id=null,result='failed',last_error='auth' where id;
     return null;
   end if;
   select * into strict s from private.podcast_session_state where id;
   if s.lease_until>now() or b.lease_until>now() then return null; end if;
   update private.podcast_master_bootstrap_state set lease_run=p_run,lease_until=now()+interval '10 minutes' where id;
   select decrypted_secret into token from vault.decrypted_secrets where id=b.secret_id;
   return jsonb_build_object('oauthToken',token,'version',s.version);
 end if;
 if b.lease_run is distinct from p_run or b.lease_until<=now() or b.result<>'pending' then raise exception 'bootstrap lease lost'; end if;
 if p_action='complete' then
   select * into strict s from private.podcast_session_state where id for update;
   if s.lease_until>now() or coalesce(p_data->>'version','') !~ '^[0-9]+$' or (p_data->>'version')::bigint<>s.version then raise exception 'session version changed'; end if;
   master=p_data->'masterEnvelope';session_data=p_data->'sessionEnvelope';
   if not coalesce(private.podcast_bootstrap_envelope_valid(master,12000),false)
      or not coalesce(private.podcast_bootstrap_envelope_valid(session_data,180000),false)
      or master->>'key_id' is distinct from session_data->>'key_id'
      or (s.envelope is not null and master->>'key_id' is distinct from s.envelope->>'key_id') then raise exception 'invalid encrypted bootstrap'; end if;
   update private.podcast_session_state set master_envelope=master,envelope=session_data,version=version+1,enabled=true,test_until=null,
     last_verified_at=now(),consecutive_failures=0,last_failure=null where id;
   update private.podcast_dispatch_state set enabled=true where id;
   update public.podcast_cloud_runtime set status='ready',last_seen_at=now() where id;
   delete from vault.secrets where id=b.secret_id;
   update private.podcast_master_bootstrap_state set secret_id=null,lease_run=null,lease_until=null,result='verified',verified_at=now(),last_error=null where id;
   return jsonb_build_object('ok',true);
 elsif p_action='fail' then
   if p_data->>'category' not in ('auth','network','invalid','unknown') then raise exception 'invalid failure'; end if;
   delete from vault.secrets where id=b.secret_id;
   update private.podcast_master_bootstrap_state set secret_id=null,lease_run=null,lease_until=null,result='failed',last_error=p_data->>'category' where id;
   return jsonb_build_object('ok',true);
 end if;
 raise exception 'invalid bootstrap action';
end; $$;
revoke all on function public.podcast_master_bootstrap_step(text,text,jsonb) from public,anon,authenticated;
grant execute on function public.podcast_master_bootstrap_step(text,text,jsonb) to service_role;
