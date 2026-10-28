-- Match the SDK's 600-second rotation interval; leave a two-minute scheduling margin.
create or replace function private.podcast_dispatch_tick() returns bigint
language plpgsql security definer set search_path=pg_catalog,private,pg_temp as $$
declare d private.podcast_dispatch_state; s private.podcast_session_state; k text; r bigint;
begin
  select * into strict d from private.podcast_dispatch_state where id for update;
  if not d.enabled then return null; end if;
  select * into strict s from private.podcast_session_state where id;
  if not s.enabled or s.consecutive_failures >= 3 then return null; end if;
  if s.test_until is not null and s.test_until <= now() then
    update private.podcast_dispatch_state set enabled=false where id;
    update private.podcast_session_state set enabled=false where id;
    return null;
  end if;
  if s.lease_until > now()
     or s.last_verified_at > now()-interval '8 minutes'
     or d.last_requested_at > now()-interval '8 minutes' then return null; end if;
  select decrypted_secret into k from vault.decrypted_secrets
    where name='globaltrend_podcast_github_dispatch';
  if k is null or length(k)<20 then raise exception 'podcast dispatch credential missing'; end if;
  select net.http_post(
    url:='https://api.github.com/repos/parksunup/globaltrend/actions/workflows/podcast-cloud.yml/dispatches',
    headers:=jsonb_build_object('Authorization','Bearer '||k,'Accept','application/vnd.github+json',
      'X-GitHub-Api-Version','2026-03-10','Content-Type','application/json'),
    body:='{"ref":"main"}'::jsonb,timeout_milliseconds:=15000) into r;
  update private.podcast_dispatch_state set last_requested_at=now(),last_request_id=r where id;
  return r;
end; $$;
revoke all on function private.podcast_dispatch_tick() from public,anon,authenticated,service_role;
