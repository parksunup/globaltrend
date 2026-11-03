-- Keep team workspace connection keys valid until explicitly revoked or replaced.
-- The key remains scoped to curated trend reads and private proposal writes.
-- Store only its hash; never grant report publication or administrative access.
update team_workspace_private.read_tokens
set expires_at = 'infinity'::timestamptz
where expires_at > now();

create or replace function team_workspace_private.issue_token(p_revoke boolean)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare token text; expires timestamptz;
begin
  if not exists(select 1 from public.team_memberships where user_id=auth.uid() and is_active) then
    raise exception 'Team login required' using errcode='42501';
  end if;
  if p_revoke then
    delete from team_workspace_private.read_tokens where user_id=auth.uid();
    return jsonb_build_object('revoked',true);
  end if;
  token := encode(extensions.gen_random_bytes(32),'hex');
  -- PostgreSQL's infinity timestamp makes existing expiry checks remain valid
  -- without changing the authorization path in read_trends/save_edits.
  expires := 'infinity'::timestamptz;
  insert into team_workspace_private.read_tokens(user_id,token_hash,expires_at)
  values(auth.uid(),encode(extensions.digest(token,'sha256'),'hex'),expires)
  on conflict(user_id) do update set token_hash=excluded.token_hash,expires_at=excluded.expires_at;
  return jsonb_build_object('token',token);
end;
$$;
