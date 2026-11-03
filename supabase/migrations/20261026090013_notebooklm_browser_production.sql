create table public.podcast_production_jobs (
  id uuid primary key default gen_random_uuid(),
  issue_key text not null unique check (issue_key ~ '^[0-9]{4}-W(0[1-9]|[1-4][0-9]|5[0-3])$'),
  packet jsonb not null check (jsonb_typeof(packet) = 'object' and octet_length(packet::text) <= 1000000),
  source_hash text not null,
  report_snapshot jsonb not null check (jsonb_typeof(report_snapshot) = 'array'),
  auto_publish boolean not null default false,
  phase text not null default 'queued' check (phase in ('queued','opening','adding_sources','generating','collecting','uploading','ready','published','needs_login','blocked','failed','cancelled')),
  notebook_url text,
  message text not null default '',
  audio_path text,
  audio_mime_type text,
  file_size_bytes bigint,
  created_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.podcast_production_jobs enable row level security;
revoke all on public.podcast_production_jobs from public, anon, authenticated;
grant select, insert, update on public.podcast_production_jobs to authenticated;
create policy "administrators manage podcast production"
  on public.podcast_production_jobs for all to authenticated
  using (private.is_team_member('admin'))
  with check (private.is_team_member('admin'));

-- Lock one job and publish its fixed packet and audio atomically. A repeated
-- completion cannot create a second issue or remove an existing published file.
create function public.publish_podcast_production_job(p_job_id uuid) returns void
language plpgsql set search_path = public, pg_temp as $$
declare j public.podcast_production_jobs; ids uuid[];
begin
  if auth.uid() is null or not private.is_team_member('admin') then
    raise exception 'admin role required' using errcode = '42501';
  end if;
  select * into strict j from public.podcast_production_jobs where id = p_job_id for update;
  if j.phase = 'published' then return; end if;
  if j.phase <> 'ready' or j.audio_path is null then
    raise exception 'audio not ready' using errcode = '22023';
  end if;
  select array_agg(value::uuid order by ordinality) into ids
    from jsonb_array_elements_text(j.packet->'reportIds') with ordinality;
  perform r.id from public.reports r where r.id = any(ids) for share;
  perform s.id from public.source_items s join public.reports r on r.source_item_id = s.id where r.id = any(ids) for share of s;
  if jsonb_array_length(j.report_snapshot) <> cardinality(ids) or exists (
    select 1 from jsonb_array_elements(j.report_snapshot) snapshot
    left join public.reports r on r.id = (snapshot->>'id')::uuid
    left join public.source_items s on s.id = r.source_item_id
    where r.id is null or r.status <> 'published'
      or r.title_ko is distinct from snapshot->>'title'
      or coalesce(r.one_line_summary_ko,'') is distinct from snapshot->>'summary'
      or coalesce(r.detailed_summary_ko,'') is distinct from snapshot->>'details'
      or s.canonical_url is distinct from snapshot->>'officialUrl'
      or coalesce((s.published_at at time zone 'UTC')::date::text,'') is distinct from snapshot->>'officialDate'
  ) then raise exception 'source content changed during production' using errcode = '22023'; end if;
  perform public.publish_weekly_podcast_issue(j.issue_key, j.packet->>'title',
    j.packet->>'description', (j.packet->>'weekStart')::date,
    (j.packet->>'weekEnd')::date, ids, j.audio_path, j.audio_mime_type, j.file_size_bytes);
  update public.podcast_production_jobs set phase = 'published', updated_at = now(), message = '' where id = j.id;
end;
$$;
revoke all on function public.publish_podcast_production_job(uuid) from public, anon;
grant execute on function public.publish_podcast_production_job(uuid) to authenticated;
