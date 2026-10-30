-- Accept a file-backed NotebookLM session that the pinned client can recover
-- by rotating a missing __Secure-1PSIDTS from Google's secondary binding.
-- Actual NotebookLM authentication is still verified by the cloud MCP job.
create or replace function public.queue_podcast_reconnect(p_storage jsonb) returns jsonb
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
  or not (
   exists(select 1 from jsonb_array_elements(p_storage->'cookies') c where c->>'name'='__Secure-1PSIDTS' and length(c->>'value')>0)
   or exists(select 1 from jsonb_array_elements(p_storage->'cookies') c where c->>'name'='OSID' and length(c->>'value')>0)
   or (exists(select 1 from jsonb_array_elements(p_storage->'cookies') c where c->>'name'='APISID' and length(c->>'value')>0)
       and exists(select 1 from jsonb_array_elements(p_storage->'cookies') c where c->>'name'='SAPISID' and length(c->>'value')>0))
  ) then raise exception 'incomplete dedicated session'; end if;
 if exists(select 1 from jsonb_array_elements(p_storage->'cookies') c where coalesce(c->>'domain','') not in ('.google.com','google.com','accounts.google.com','notebooklm.google.com','notebook.google.com') or coalesce(c->>'path','')<>'/') then raise exception 'invalid cookie scope'; end if;
 if r.secret_id is not null then delete from vault.secrets where id=r.secret_id; end if;
 select vault.create_secret(p_storage::text) into h;
 update private.podcast_reconnect_state set secret_id=h,requested_at=now(),requested_by=auth.uid(),result='pending' where id;
 update private.podcast_session_state set enabled=true,test_until=null,consecutive_failures=0,last_failure=null where id;
 update private.podcast_dispatch_state set enabled=true where id;
 perform private.podcast_dispatch_tick();
 return jsonb_build_object('ok',true,'result','pending');
end; $$;
revoke all on function public.queue_podcast_reconnect(jsonb) from public,anon;
grant execute on function public.queue_podcast_reconnect(jsonb) to authenticated;
