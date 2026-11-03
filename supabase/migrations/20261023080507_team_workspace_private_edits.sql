-- Team/Codex can edit workspace proposals, never operating reports or publication state.
create table team_workspace_private.trend_edits (
  report_id uuid primary key references public.reports(id) on delete cascade,
  payload jsonb not null,
  revision bigint not null default 1,
  updated_by uuid not null references auth.users(id),
  updated_at timestamptz not null default now()
);
alter table team_workspace_private.trend_edits enable row level security;
revoke all on team_workspace_private.trend_edits from public,anon,authenticated;

create or replace function team_workspace_private.read_with_edits(p_offset integer,p_limit integer,p_token text)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
  result:=team_workspace_private.read_trends(p_offset,p_limit,p_token);
  return jsonb_set(result,'{items}',coalesce((select jsonb_agg(item || jsonb_build_object(
    'workspace_edit',e.payload,'workspace_revision',coalesce(e.revision,0)) order by item->>'id')
    from jsonb_array_elements(result->'items') item
    left join team_workspace_private.trend_edits e on e.report_id=(item->>'id')::uuid),'[]'::jsonb));
end;
$$;
revoke all on function team_workspace_private.read_with_edits(integer,integer,text) from public;
grant execute on function team_workspace_private.read_with_edits(integer,integer,text) to anon,authenticated;
create or replace function public.get_team_trend_workspace(p_offset integer default 0,p_limit integer default 200,p_token text default null)
returns jsonb language sql stable security invoker set search_path='' as $$
  select team_workspace_private.read_with_edits(p_offset,p_limit,p_token);
$$;

create or replace function team_workspace_private.save_edits(p_edits jsonb,p_token text)
returns jsonb language plpgsql security definer set search_path='' set statement_timeout='10s' as $$
declare entry jsonb; edit jsonb; target uuid; expected bigint; current_revision bigint;
  actor uuid; current_row jsonb; page jsonb; page_offset integer; saved integer:=0;
begin
  perform team_workspace_private.read_trends(0,1,p_token);
  select user_id into actor from public.team_memberships where user_id=auth.uid() and is_active;
  if actor is null then
    select t.user_id into actor from team_workspace_private.read_tokens t
    join public.team_memberships m on m.user_id=t.user_id and m.is_active
    where t.token_hash=encode(extensions.digest(p_token,'sha256'),'hex') and t.expires_at>now();
  end if;
  if jsonb_typeof(p_edits) is distinct from 'array' or jsonb_array_length(p_edits) not between 1 and 100 then
    raise exception 'Supply 1 to 100 workspace edits' using errcode='22023';
  end if;
  if (select count(distinct value->'edit'->>'report_id') from jsonb_array_elements(p_edits))<>jsonb_array_length(p_edits) then
    raise exception 'Duplicate or missing report ID' using errcode='22023';
  end if;
  for entry in select value from jsonb_array_elements(p_edits) order by value->'edit'->>'report_id' loop
    edit:=entry->'edit';
    if jsonb_typeof(edit) is distinct from 'object' then raise exception 'Invalid edit object' using errcode='22023'; end if;
    if (select count(*) from jsonb_object_keys(edit))<>5 or not(edit ?& array['report_id','base_revision','title_ko','summary_ko','details_ko']) then
      raise exception 'Only five editorial fields are accepted' using errcode='22023';
    end if;
    if exists(select 1 from unnest(array['title_ko','summary_ko','details_ko']) k
      where jsonb_typeof(edit->k) is distinct from 'string' or length(btrim(edit->>k)) not between 1 and 100000) then
      raise exception 'Invalid editorial text' using errcode='22023';
    end if;
    target:=(edit->>'report_id')::uuid;
    if coalesce(entry->>'expected_revision','') !~ '^[0-9]+$' then raise exception 'Expected workspace revision required' using errcode='22023'; end if;
    expected:=(entry->>'expected_revision')::bigint;
    perform pg_advisory_xact_lock(hashtextextended(target::text,0));
    perform 1 from public.reports where id=target for share;
    current_revision:=null;
    select revision into current_revision from team_workspace_private.trend_edits where report_id=target;
    if coalesce(current_revision,0)<>expected then raise exception 'Workspace revision conflict: %',target using errcode='40001'; end if;
    current_row:=null;page_offset:=0;
    loop
      page:=team_workspace_private.read_trends(page_offset,200,p_token);
      select value into current_row from jsonb_array_elements(page->'items') where value->>'id'=target::text;
      exit when current_row is not null or page->>'nextOffset' is null;
      page_offset:=(page->>'nextOffset')::integer;
    end loop;
    if current_row is null then raise exception 'Report not available: %',target using errcode='22023'; end if;
    if current_row->>'revision' is distinct from edit->>'base_revision' then
      raise exception 'Base report revision conflict: %',target using errcode='40001';
    end if;
    insert into team_workspace_private.trend_edits(report_id,payload,revision,updated_by)
    values(target,edit,1,actor)
    on conflict(report_id) do update set payload=excluded.payload,revision=trend_edits.revision+1,updated_by=excluded.updated_by,updated_at=now();
    saved:=saved+1;
  end loop;
  return jsonb_build_object('saved',saved,'published',false);
end;
$$;
revoke all on function team_workspace_private.save_edits(jsonb,text) from public;
grant execute on function team_workspace_private.save_edits(jsonb,text) to anon,authenticated;
create or replace function public.save_team_trend_edits(p_edits jsonb,p_token text default null)
returns jsonb language sql security invoker set search_path='' as $$
  select team_workspace_private.save_edits(p_edits,p_token);
$$;
revoke all on function public.save_team_trend_edits(jsonb,text) from public;
grant execute on function public.save_team_trend_edits(jsonb,text) to anon,authenticated;
comment on function public.save_team_trend_edits(jsonb,text) is 'Team session or scoped 24h connection may update private workspace proposals only; optimistic concurrency; no operating report writes or publishing.';
