-- Common, idempotent database entrypoint for trusted collection workers.
-- Source-specific adapters remain separate; this migration only defines how
-- normalized items, content revisions, and draft jobs are persisted.

create table public.source_item_revisions (
  id uuid primary key default gen_random_uuid(),
  source_item_id uuid not null references public.source_items(id) on delete cascade,
  content_hash text not null check (content_hash ~ '^[0-9a-f]{64}$'),
  content_text text not null check (nullif(btrim(content_text), '') is not null),
  fetched_at timestamptz not null,
  raw_storage_path text,
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now(),
  unique (source_item_id, content_hash)
);

alter table public.source_items
  add column current_revision_id uuid references public.source_item_revisions(id) on delete set null;

alter table public.draft_jobs
  add column source_item_revision_id uuid references public.source_item_revisions(id) on delete restrict;

create index source_item_revisions_item_created_idx
  on public.source_item_revisions (source_item_id, created_at desc);
create index draft_jobs_revision_idx
  on public.draft_jobs (source_item_revision_id)
  where source_item_revision_id is not null;

alter table public.source_item_revisions enable row level security;

revoke all on table public.source_item_revisions from anon, authenticated;
grant select, insert, update, delete on table public.source_item_revisions to service_role;
grant select, insert, update on table public.source_items to service_role;
grant select, insert, update on table public.draft_jobs to service_role;

create or replace function public.ingest_source_item(
  p_source_id uuid,
  p_external_id text,
  p_canonical_url text,
  p_title_original text,
  p_published_at timestamptz,
  p_event_date date,
  p_fetched_at timestamptz,
  p_language_code text,
  p_document_type text,
  p_content_text text,
  p_content_hash text,
  p_raw_storage_path text,
  p_metadata jsonb,
  p_instruction_version text
)
returns table (
  source_item_id uuid,
  source_item_revision_id uuid,
  draft_job_id uuid,
  item_created boolean,
  content_changed boolean
)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_item public.source_items;
  v_revision_id uuid;
  v_job_id uuid;
  v_item_created boolean := false;
  v_content_changed boolean := false;
  v_metadata jsonb := coalesce(p_metadata, '{}'::jsonb);
begin
  if jsonb_typeof(v_metadata) <> 'object' then
    raise invalid_parameter_value using message = 'Metadata must be a JSON object';
  end if;

  if nullif(btrim(p_canonical_url), '') is null
     or lower(split_part(p_canonical_url, '://', 1)) not in ('http', 'https') then
    raise invalid_parameter_value using message = 'Canonical URL must use HTTP or HTTPS';
  end if;

  if nullif(btrim(p_title_original), '') is null then
    raise invalid_parameter_value using message = 'Original title is required';
  end if;

  if (p_content_text is null) <> (p_content_hash is null) then
    raise invalid_parameter_value using message = 'Content text and SHA-256 hash must be supplied together';
  end if;

  if p_content_hash is not null and p_content_hash !~ '^[0-9a-f]{64}$' then
    raise invalid_parameter_value using message = 'Content hash must be a lowercase SHA-256 hex digest';
  end if;

  if p_content_text is not null and nullif(btrim(p_content_text), '') is null then
    raise invalid_parameter_value using message = 'Fetched content cannot be empty';
  end if;

  if nullif(btrim(p_instruction_version), '') is null then
    raise invalid_parameter_value using message = 'Instruction version is required';
  end if;

  perform 1
  from public.sources s
  where s.id = p_source_id and s.is_active;

  if not found then
    raise invalid_parameter_value using message = 'Source does not exist or is inactive';
  end if;

  select si.*
  into v_item
  from public.source_items si
  where si.source_id = p_source_id
    and si.canonical_url = btrim(p_canonical_url)
  for update;

  if not found then
    insert into public.source_items (
      source_id,
      external_id,
      canonical_url,
      title_original,
      published_at,
      event_date,
      fetched_at,
      language_code,
      document_type,
      content_text,
      content_hash,
      raw_storage_path,
      pipeline_status,
      metadata
    ) values (
      p_source_id,
      nullif(btrim(p_external_id), ''),
      btrim(p_canonical_url),
      btrim(p_title_original),
      p_published_at,
      p_event_date,
      p_fetched_at,
      nullif(btrim(p_language_code), ''),
      p_document_type,
      p_content_text,
      p_content_hash,
      nullif(btrim(p_raw_storage_path), ''),
      case when p_content_hash is null then 'discovered' else 'queued' end,
      v_metadata
    )
    returning * into v_item;

    v_item_created := true;
    v_content_changed := p_content_hash is not null;
  else
    v_content_changed := p_content_hash is not null
      and p_content_hash is distinct from v_item.content_hash;

    update public.source_items
    set external_id = coalesce(nullif(btrim(p_external_id), ''), external_id),
        title_original = btrim(p_title_original),
        published_at = coalesce(p_published_at, published_at),
        event_date = coalesce(p_event_date, event_date),
        fetched_at = coalesce(p_fetched_at, fetched_at),
        language_code = coalesce(nullif(btrim(p_language_code), ''), language_code),
        document_type = p_document_type,
        content_text = case when p_content_hash is null then content_text else p_content_text end,
        content_hash = coalesce(p_content_hash, content_hash),
        raw_storage_path = coalesce(nullif(btrim(p_raw_storage_path), ''), raw_storage_path),
        pipeline_status = case when v_content_changed then 'queued' else pipeline_status end,
        relevance_status = case when v_content_changed then 'unscored' else relevance_status end,
        metadata = metadata || v_metadata,
        updated_at = now()
    where id = v_item.id
    returning * into v_item;
  end if;

  if p_content_hash is not null then
    insert into public.source_item_revisions (
      source_item_id,
      content_hash,
      content_text,
      fetched_at,
      raw_storage_path,
      metadata
    ) values (
      v_item.id,
      p_content_hash,
      p_content_text,
      coalesce(p_fetched_at, now()),
      nullif(btrim(p_raw_storage_path), ''),
      v_metadata
    )
    on conflict (source_item_id, content_hash) do update
    set fetched_at = greatest(public.source_item_revisions.fetched_at, excluded.fetched_at),
        raw_storage_path = coalesce(excluded.raw_storage_path, public.source_item_revisions.raw_storage_path),
        metadata = public.source_item_revisions.metadata || excluded.metadata
    returning id into v_revision_id;

    update public.source_items
    set current_revision_id = v_revision_id,
        updated_at = now()
    where id = v_item.id;

    insert into public.draft_jobs (
      source_item_id,
      source_item_revision_id,
      instruction_version,
      input_hash
    ) values (
      v_item.id,
      v_revision_id,
      btrim(p_instruction_version),
      p_content_hash
    )
    on conflict (source_item_id, instruction_version, input_hash) do update
    set source_item_revision_id = excluded.source_item_revision_id
    returning id into v_job_id;
  end if;

  return query
  select v_item.id, v_revision_id, v_job_id, v_item_created, v_content_changed;
end;
$$;

revoke all on function public.ingest_source_item(
  uuid, text, text, text, timestamptz, date, timestamptz, text, text,
  text, text, text, jsonb, text
) from public, anon, authenticated;
grant execute on function public.ingest_source_item(
  uuid, text, text, text, timestamptz, date, timestamptz, text, text,
  text, text, text, jsonb, text
) to service_role;
