-- Draft source text becomes visible only after its report is published.
drop policy if exists source_items_public_select on public.source_items;
create policy source_items_public_select on public.source_items for select to anon, authenticated
  using (exists (
    select 1 from public.reports r
    where r.source_item_id = source_items.id and r.status = 'published'
  ));

-- RLS permits team editors to save drafts. This trigger reserves the final
-- approval and publication transitions for an active administrator, even when
-- a client talks to the Supabase Data API without using our web form.
create or replace function private.guard_report_publication()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
begin
  if new.status in ('approved', 'published')
     or (tg_op = 'UPDATE' and old.status in ('approved', 'published')) then
    if not private.is_team_member('admin') then
      raise insufficient_privilege using message = 'Administrator approval is required';
    end if;
  end if;

  if new.status = 'approved' and (tg_op = 'INSERT' or old.status <> 'approved') then
    new.human_reviewed := true;
    new.reviewed_by := auth.uid();
    new.reviewed_at := now();
  end if;

  if new.status = 'published' and (tg_op = 'INSERT' or old.status <> 'published') then
    if tg_op = 'INSERT' or old.status <> 'approved' or not old.human_reviewed then
      raise invalid_parameter_value using message = 'Approve the report before publication';
    end if;
    new.published_at := now();
  end if;

  if tg_op = 'UPDATE' and old.status = 'published' and new.status <> 'published' then
    new.published_at := null;
  end if;
  new.updated_at := now();
  return new;
end;
$$;

revoke all on function private.guard_report_publication() from public, anon, authenticated;
drop trigger if exists guard_report_publication on public.reports;
create trigger guard_report_publication
  before insert or update on public.reports
  for each row execute function private.guard_report_publication();

-- Keep creation of the source record and Korean draft atomic.
-- The invoker needs schema USAGE to call the narrowly granted membership helper.
-- This does not grant access to the publication trigger function.
grant usage on schema private to authenticated;

create or replace function public.create_report_draft(
  p_source_id uuid,
  p_canonical_url text,
  p_original_title text,
  p_title_ko text,
  p_summary_ko text,
  p_details_ko text,
  p_jurisdictions text[],
  p_topics text[],
  p_source_published_at timestamptz default null
)
returns uuid
language plpgsql
security invoker
set search_path = pg_catalog, public, private
as $$
declare
  v_source_item_id uuid;
  v_report_id uuid;
begin
  if not private.is_team_member('editor') then
    raise insufficient_privilege using message = 'Active editor membership is required';
  end if;
  if not exists (select 1 from public.sources where id = p_source_id and is_active) then
    raise invalid_parameter_value using message = 'Choose an active source';
  end if;
  if p_canonical_url !~* '^https://[^[:space:]]+$'
     or length(p_canonical_url) > 2000
     or nullif(btrim(p_original_title), '') is null
     or nullif(btrim(p_title_ko), '') is null
     or nullif(btrim(p_summary_ko), '') is null
     or length(p_original_title) > 500
     or length(p_title_ko) > 500
     or length(p_summary_ko) > 3000
     or length(coalesce(p_details_ko, '')) > 20000 then
    raise invalid_parameter_value using message = 'Required draft fields are missing or too long';
  end if;

  insert into public.source_items (
    source_id, canonical_url, title_original, published_at,
    document_type, pipeline_status, relevance_status
  ) values (
    p_source_id, btrim(p_canonical_url), btrim(p_original_title),
    p_source_published_at, 'other', 'discovered', 'needs_review'
  ) returning id into v_source_item_id;

  insert into public.reports (
    source_item_id, title_ko, one_line_summary_ko,
    detailed_summary_ko, jurisdictions, topics, status
  ) values (
    v_source_item_id, btrim(p_title_ko), btrim(p_summary_ko),
    nullif(btrim(p_details_ko), ''), coalesce(p_jurisdictions, '{}'),
    coalesce(p_topics, '{}'), 'draft'
  ) returning id into v_report_id;

  return v_report_id;
end;
$$;

revoke all on function public.create_report_draft(
  uuid, text, text, text, text, text, text[], text[], timestamptz
) from public, anon;
grant execute on function public.create_report_draft(
  uuid, text, text, text, text, text, text[], text[], timestamptz
) to authenticated;
