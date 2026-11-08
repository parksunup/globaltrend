-- Remove application-imposed ceilings that discarded discovered collector data.
-- Keep identity/host/schema checks, positive-page checks, execution pacing,
-- and the real database-capacity guard. This migration never truncates rows.

do $constraints$
declare
  item record;
begin
  -- PostgreSQL derives names for inline checks from column/table context;
  -- identify the exact old checks by their expressions, not guessed names.
  for item in
    select conrelid::regclass as relation, conname
    from pg_constraint
    where contype='c'
      and conrelid in ('public.collector_cloud_listing_scans'::regclass,
                       'public.collector_cloud_listing_rows'::regclass)
      and (
        pg_get_constraintdef(oid) ilike '%row_count%100%'
        or pg_get_constraintdef(oid) ilike '%ordinal%99%'
        or pg_get_constraintdef(oid) ilike '%canonical_url%2048%'
        or pg_get_constraintdef(oid) ilike '%row_data%5000%'
      )
  loop
    execute format('alter table %s drop constraint %I',item.relation,item.conname);
  end loop;
  alter table public.collector_cloud_listing_scans
    add constraint collector_cloud_listing_scans_row_count_positive check (row_count > 0);
  alter table public.collector_cloud_listing_rows
    add constraint collector_cloud_listing_rows_ordinal_nonnegative check (ordinal >= 0),
    add constraint collector_cloud_listing_rows_data_shape check
      (jsonb_typeof(row_data)='object' and row_data->>'url'=canonical_url),
    add constraint collector_cloud_listing_rows_official_url check
      (canonical_url ~ '^https://www[.]ftc[.]gov/'
        and position('?' in canonical_url)=0 and position('#' in canonical_url)=0);
end;
$constraints$;

do $remove_caps$
declare
  target record;
  definition text;
  updated text;
  changed boolean;
begin
  -- Scope edits to collector routines only; unrelated product/workspace limits
  -- are not part of collection and must not be altered here.
  for target in
    select p.oid, n.nspname, p.proname
    from pg_proc p
    join pg_namespace n on n.oid=p.pronamespace
    where p.prokind='f'
      and n.nspname in ('public','private')
      and (p.proname like 'collector\_%' escape '\' or p.proname='claim_trend_draft_jobs')
  loop
    definition=pg_get_functiondef(target.oid);
    updated=definition;

    -- Cursor and request-bundle byte ceilings.
    updated=regexp_replace(updated,
      ' or octet_length\(coalesce\(p_cursor::text,[^)]*\)\)\s*>\s*4000','', 'gi');
    updated=regexp_replace(updated,
      ' or octet_length\(p_cursor::text\)\s*>\s*4000','', 'gi');
    updated=regexp_replace(updated,
      ' or octet_length\(c::text\)\s*>\s*4000','', 'gi');
    updated=regexp_replace(updated,
      ' or octet_length\(p_bundle::text\)\s*>\s*500000','', 'gi');
    updated=regexp_replace(updated,
      ' or octet_length\(d::text\)\s*>\s*480000','', 'gi');

    -- Cursor item counts and page-number digit ceilings.
    updated=regexp_replace(updated,
      'if jsonb_array_length\(c->''processed_url_hashes''\)\s*>\s*50 then return false; end if;','', 'gi');
    updated=regexp_replace(updated,
      'jsonb_array_length\(c->''processed_url_hashes''\)\s*>\s*50\s+or\s+','', 'gi');
    updated=regexp_replace(updated,
      '\s+or\s+jsonb_array_length\(c->''processed_url_hashes''\)\s*>\s*50','', 'gi');
    updated=regexp_replace(updated,
      'count_urls\s+not between\s+1\s+and\s+100\s+or\s+octet_length\(c::text\)\s*>\s*4000',
      'count_urls<1', 'gi');
    updated=regexp_replace(updated,
      'count_urls\s+not between\s+1\s+and\s+100\s+or\s+not \(c \? ''frozen_next''\)',
      'count_urls<1 or not (c ? ''frozen_next'')', 'gi');
    updated=regexp_replace(updated,
      '\s+or\s+octet_length\(u#>>''\{\}''\)\s*>\s*2048','', 'gi');
    updated=replace(updated,'''^[0-9]{1,6}$''','''^[0-9]+$''');

    -- Source text and article-body ceilings. Preserve non-empty validation.
    updated=regexp_replace(updated,
      'length\(r\.content_text\)\s+between\s+10\s+and\s+80000',
      'length(r.content_text)>=10', 'gi');
    updated=regexp_replace(updated,
      'length\(r\.content_text\)\s+not between\s+10\s+and\s+80000',
      'length(r.content_text)<10', 'gi');
    updated=regexp_replace(updated,
      'octet_length\(body\)\s+not between\s+100\s+and\s+400000',
      'nullif(btrim(body),'''') is null', 'gi');

    -- Listing row count, URL/title length, and per-row serialization ceilings.
    updated=regexp_replace(updated,
      'jsonb_array_length\(listing->''rows''\)\s+not between\s+1\s+and\s+100',
      'jsonb_array_length(listing->''rows'')<1', 'gi');
    updated=regexp_replace(updated,
      'octet_length\(x->>''url''\)\s*>\s*2048\s+or\s*','', 'gi');
    updated=regexp_replace(updated,
      'octet_length\(x->>''title''\)\s*>\s*1000\s+or\s*','', 'gi');
    updated=regexp_replace(updated,
      'jsonb_array_length\(coalesce\(x->''date_observations'',''\[\]''::jsonb\)\)\s*>\s*4\s+or\s*','', 'gi');
    updated=regexp_replace(updated,
      'octet_length\(x::text\)\s*>\s*5000\s+or\s*','', 'gi');
    updated=regexp_replace(updated,
      '\s+or\s+octet_length\(x::text\)\s*>\s*5000','', 'gi');

    -- Queue state/result, web-attempt detail, and draft-source text ceilings.
    updated=regexp_replace(updated,
      'octet_length\(p_state::text\)\s*>\s*250000\s+or\s*','', 'gi');
    updated=regexp_replace(updated,
      '\s+or\s+octet_length\(p_result::text\)\s*>\s*(100000|20000)','', 'gi');
    updated=regexp_replace(updated,
      'if\s+octet_length\(p_result::text\)\s*>\s*100000\s+or\s*', 'if ', 'gi');
    updated=regexp_replace(updated,
      'length\(p_title\)\s+not between\s+1\s+and\s+1000\s+or\s*',
      'nullif(btrim(p_title),'''') is null or ', 'gi');
    updated=regexp_replace(updated,
      'length\(title\)\s+not between\s+1\s+and\s+1000\s+or\s*',
      'nullif(btrim(title),'''') is null or ', 'gi');
    updated=regexp_replace(updated,
      'p_limit\s+not between\s+1\s+and\s+10', 'p_limit<1', 'gi');

    changed=updated is distinct from definition;
    if changed then
      execute updated;
    end if;
  end loop;
end;
$remove_caps$;

-- Validate that the data ceilings were removed without flagging the separate
-- real 400 MB Supabase project-capacity guard or per-claim atomicity rules.
do $verify$
declare leftover text;
begin
  select string_agg(n.nspname||'.'||p.proname, ', ' order by n.nspname,p.proname)
  into leftover
  from pg_proc p
  join pg_namespace n on n.oid=p.pronamespace
  where p.prokind='f' and n.nspname in ('public','private')
    and (p.proname like 'collector\_%' escape '\' or p.proname='claim_trend_draft_jobs')
    and p.prosrc ~* '(^|[^0-9])(80000|400000|480000|500000|250000|20000|2048|100000)([^0-9]|$)|octet_length\([^)]*::text\)\s*>\s*4000|processed_url_hashes[^;]*>\s*50|count_urls\s+not between\s+1\s+and\s+100|listing->''rows''\)\s+not between\s+1\s+and\s+100|date_observations[^;]*>\s*4|p_limit\s+not between\s+1\s+and\s+10|length\((p_title|title)\)\s+not between\s+1\s+and\s+1000';
  if leftover is not null then
    raise exception 'collector data ceilings remain in: %',leftover;
  end if;
end;
$verify$;
