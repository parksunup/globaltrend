-- Keep the team trend workspace ordered by report registration date.
-- The content revision deliberately excludes created_at so adding this
-- metadata does not invalidate existing Codex edits.
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
    select r.id, r.status, r.created_at,
      s.title_original as original_title, s.canonical_url as official_url,
      coalesce(o.name,'공식 출처') as source_name,
      coalesce(s.published_at::date::text,'') as published_date,
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
    select rows.*, md5((to_jsonb(rows)-'created_at')::text) as revision from rows
  ), page as (
    select * from identified order by created_at desc, id desc offset p_offset limit p_limit
  )
  select jsonb_build_object(
    'items',coalesce((select jsonb_agg(to_jsonb(page) order by created_at desc, id desc) from page),'[]'::jsonb),
    'total',(select count(*) from rows),
    'nextOffset',case when p_offset+p_limit < (select count(*) from rows) then to_jsonb(p_offset+p_limit) else 'null'::jsonb end
  ) into result;
  return result;
end;
$$;

create or replace function team_workspace_private.read_with_edits(p_offset integer,p_limit integer,p_token text)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
  result:=team_workspace_private.read_trends(p_offset,p_limit,p_token);
  return jsonb_set(result,'{items}',coalesce((
    select jsonb_agg(item || jsonb_build_object(
      'workspace_edit',e.payload,'workspace_revision',coalesce(e.revision,0)
    ) order by (item->>'created_at')::timestamptz desc, item->>'id' desc)
    from jsonb_array_elements(result->'items') item
    left join team_workspace_private.trend_edits e on e.report_id=(item->>'id')::uuid
  ),'[]'::jsonb));
end;
$$;

