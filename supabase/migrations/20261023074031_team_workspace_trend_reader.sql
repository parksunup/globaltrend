-- Team login or a team-issued, expiring read-only capability is required.
-- No anonymous listing, raw source access, or report writes.
create schema if not exists team_workspace_private;
revoke all on schema team_workspace_private from public;
grant usage on schema team_workspace_private to anon, authenticated;

create table if not exists team_workspace_private.read_tokens (
  user_id uuid primary key references auth.users(id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null
);
alter table team_workspace_private.read_tokens enable row level security;
revoke all on team_workspace_private.read_tokens from public, anon, authenticated;

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
  expires := now()+interval '24 hours';
  insert into team_workspace_private.read_tokens(user_id,token_hash,expires_at)
  values(auth.uid(),encode(extensions.digest(token,'sha256'),'hex'),expires)
  on conflict(user_id) do update set token_hash=excluded.token_hash,expires_at=excluded.expires_at;
  return jsonb_build_object('token',token,'expiresAt',expires);
end;
$$;
revoke all on function team_workspace_private.issue_token(boolean) from public;
grant execute on function team_workspace_private.issue_token(boolean) to authenticated;
create or replace function public.issue_team_workspace_token(p_revoke boolean default false)
returns jsonb language sql security invoker set search_path='' as $$
  select team_workspace_private.issue_token(p_revoke);
$$;
revoke all on function public.issue_team_workspace_token(boolean) from public;
grant execute on function public.issue_team_workspace_token(boolean) to authenticated;

create or replace function team_workspace_private.read_trends(p_offset integer, p_limit integer, p_token text)
returns jsonb language plpgsql stable security definer
set search_path = '' set statement_timeout = '5s'
as $$
declare result jsonb;
begin
  if not exists(select 1 from public.team_memberships where user_id=auth.uid() and is_active)
     and not exists(select 1 from team_workspace_private.read_tokens t
       join public.team_memberships m on m.user_id=t.user_id and m.is_active
       where t.token_hash=encode(extensions.digest(p_token,'sha256'),'hex') and t.expires_at>now()) then
    raise exception 'Team login or valid workspace connection required' using errcode='42501';
  end if;
  if p_offset is null or p_limit is null or p_offset < 0 or p_limit < 1 or p_limit > 200 then
    raise exception 'Invalid workspace page' using errcode='22023';
  end if;
  with rows as (
    select r.id, r.status, s.title_original as original_title, s.canonical_url as official_url,
      coalesce(o.name,'공식 출처') as source_name, coalesce(s.published_at::date::text,'') as published_date,
      coalesce(w.payload->>'title_ko',r.title_ko,'') as title_ko,
      coalesce(w.payload->>'one_line_summary_ko',r.one_line_summary_ko,'') as summary_ko,
      coalesce(w.payload->>'detailed_summary_ko',r.detailed_summary_ko,'') as details_ko,
      coalesce(w.payload->'jurisdictions',to_jsonb(r.jurisdictions),'[]'::jsonb) as jurisdictions,
      coalesce(w.payload->'topics',to_jsonb(r.topics),'[]'::jsonb) as topics
    from public.reports r
    join public.source_items s on s.id=r.source_item_id
    left join public.sources o on o.id=s.source_id
    left join public.publication_working_copies w on w.entity_type='report' and w.entity_id=r.id
    where r.status in ('draft','in_review','approved','published','rejected') and w.trashed_at is null
  ), identified as (
    select rows.*, md5(to_jsonb(rows)::text) as revision from rows
  ), page as (
    select * from identified order by id offset p_offset limit p_limit
  )
  select jsonb_build_object('items',coalesce((select jsonb_agg(to_jsonb(page) order by id) from page),'[]'::jsonb),
    'total',(select count(*) from rows),
    'nextOffset',case when p_offset+p_limit < (select count(*) from rows) then to_jsonb(p_offset+p_limit) else 'null'::jsonb end)
  into result;
  return result;
end;
$$;
revoke all on function team_workspace_private.read_trends(integer,integer,text) from public;
grant execute on function team_workspace_private.read_trends(integer,integer,text) to anon, authenticated;

create or replace function public.get_team_trend_workspace(p_offset integer default 0,p_limit integer default 200,p_token text default null)
returns jsonb language sql stable security invoker set search_path = ''
as $$ select team_workspace_private.read_trends(p_offset,p_limit,p_token); $$;
revoke all on function public.get_team_trend_workspace(integer,integer,text) from public;
grant execute on function public.get_team_trend_workspace(integer,integer,text) to anon, authenticated;
comment on function public.get_team_trend_workspace(integer,integer,text) is
'Team session or expiring team-issued read capability required; curated editorial text only, no source raw text or report writes.';
