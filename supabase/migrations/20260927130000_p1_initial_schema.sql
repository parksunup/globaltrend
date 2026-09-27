-- P1 initial schema for globaltrend
create extension if not exists pgcrypto;

create schema if not exists private;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  display_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.team_memberships (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('admin','editor','reviewer')),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function private.is_team_member(required_role text default null)
returns boolean
language sql
stable
security definer
set search_path = public, pg_catalog
as $$
  select exists (
    select 1
    from public.team_memberships tm
    where tm.user_id = (select auth.uid())
      and tm.is_active
      and (required_role is null or
        case required_role
          when 'editor' then tm.role in ('admin','editor')
          when 'reviewer' then tm.role in ('admin','editor','reviewer')
          when 'admin' then tm.role = 'admin'
          else false
        end)
  );
$$;

revoke all on function private.is_team_member(text) from public;
grant execute on function private.is_team_member(text) to authenticated;

create table public.publishers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  acronym text,
  jurisdiction_code text,
  publisher_type text not null default 'other'
    check (publisher_type in ('supervisory_authority','international_org','court','government','media','other')),
  website_url text,
  description_ko text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.sources (
  id uuid primary key default gen_random_uuid(),
  publisher_id uuid not null references public.publishers(id),
  name text not null,
  source_kind text not null check (source_kind in ('rss','atom','sitemap','json_api','html','manual')),
  fetch_strategy text not null default 'http' check (fetch_strategy in ('http','browser','manual')),
  start_url text not null,
  parser_config jsonb not null default '{}'::jsonb check (jsonb_typeof(parser_config) = 'object'),
  poll_interval_minutes integer not null default 360 check (poll_interval_minutes >= 10),
  next_run_at timestamptz not null default now(),
  respect_robots boolean not null default true,
  terms_reviewed_at timestamptz,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.source_items (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null references public.sources(id),
  external_id text,
  canonical_url text not null,
  title_original text not null,
  published_at timestamptz,
  event_date date,
  discovered_at timestamptz not null default now(),
  fetched_at timestamptz,
  language_code text,
  document_type text not null default 'other'
    check (document_type in ('news','press_release','guidance','decision','judgment','opinion','report','legislation','other')),
  content_text text,
  content_hash text,
  raw_storage_path text,
  pipeline_status text not null default 'discovered'
    check (pipeline_status in ('discovered','fetched','queued','processing','drafted','failed','ignored')),
  relevance_status text not null default 'unscored'
    check (relevance_status in ('unscored','relevant','irrelevant','needs_review')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (source_id, canonical_url)
);

create table public.draft_jobs (
  id uuid primary key default gen_random_uuid(),
  source_item_id uuid not null references public.source_items(id) on delete cascade,
  status text not null default 'pending'
    check (status in ('pending','claimed','submitted','needs_human_review','failed','cancelled')),
  claimed_by text,
  claimed_at timestamptz,
  lease_until timestamptz,
  instruction_version text not null,
  input_hash text not null,
  attempts integer not null default 0,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (source_item_id, instruction_version, input_hash)
);

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  source_item_id uuid not null unique references public.source_items(id),
  title_ko text not null,
  one_line_summary_ko text,
  detailed_summary_ko text,
  key_points jsonb not null default '[]'::jsonb check (jsonb_typeof(key_points) = 'array'),
  policy_implications_ko text,
  jurisdictions text[] not null default '{}',
  topics text[] not null default '{}',
  status text not null default 'draft'
    check (status in ('draft','in_review','approved','published','excluded')),
  codex_run_id text,
  human_reviewed boolean not null default false,
  reviewed_by uuid references public.profiles(id),
  reviewed_at timestamptz,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.report_evidence (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.reports(id) on delete cascade,
  source_item_id uuid not null references public.source_items(id),
  locator jsonb not null default '{}'::jsonb,
  excerpt text,
  created_at timestamptz not null default now(),
  unique (report_id, source_item_id, locator)
);

create table public.legal_instruments (
  id uuid primary key default gen_random_uuid(),
  jurisdiction_code text not null,
  short_name text not null,
  official_name text not null,
  instrument_type text not null default 'law',
  official_url text,
  is_published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (jurisdiction_code, short_name)
);

create table public.law_versions (
  id uuid primary key default gen_random_uuid(),
  legal_instrument_id uuid not null references public.legal_instruments(id) on delete cascade,
  version_label text not null,
  valid_from date,
  valid_to date,
  effective_date date,
  source_checked_at timestamptz,
  source_url text,
  status text not null default 'unverified'
    check (status in ('draft','unverified','verified','published','superseded')),
  created_at timestamptz not null default now(),
  unique (legal_instrument_id, version_label)
);

create table public.provision_nodes (
  id uuid primary key default gen_random_uuid(),
  law_version_id uuid not null references public.law_versions(id) on delete cascade,
  parent_id uuid references public.provision_nodes(id),
  node_key text not null,
  heading text,
  original_text text,
  translation_ko text,
  translation_status text not null default 'draft'
    check (translation_status in ('draft','needs_review','approved','published')),
  source_locator jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (law_version_id, node_key)
);

create table public.criteria_sets (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  version integer not null default 1,
  is_published boolean not null default false,
  created_at timestamptz not null default now(),
  unique (name, version)
);

create table public.criteria (
  id uuid primary key default gen_random_uuid(),
  criteria_set_id uuid not null references public.criteria_sets(id) on delete cascade,
  criterion_key text not null,
  label_ko text not null,
  description_ko text,
  sort_order integer not null,
  created_at timestamptz not null default now(),
  unique (criteria_set_id, criterion_key)
);

create table public.comparison_cells (
  id uuid primary key default gen_random_uuid(),
  criterion_id uuid not null references public.criteria(id) on delete cascade,
  law_version_id uuid not null references public.law_versions(id) on delete cascade,
  summary_ko text,
  status text not null default 'unreviewed'
    check (status in ('unreviewed','in_review','approved','published','not_found','not_applicable')),
  reviewed_by uuid references public.profiles(id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (criterion_id, law_version_id)
);

create table public.comparison_cell_provisions (
  comparison_cell_id uuid not null references public.comparison_cells(id) on delete cascade,
  provision_node_id uuid not null references public.provision_nodes(id),
  relation_type text not null default 'direct'
    check (relation_type in ('direct','related','exception','interpretive')),
  primary key (comparison_cell_id, provision_node_id)
);

create table public.report_provision_links (
  report_id uuid not null references public.reports(id) on delete cascade,
  provision_node_id uuid not null references public.provision_nodes(id),
  mention_text text,
  confidence text not null default 'unconfirmed'
    check (confidence in ('unconfirmed','candidate','confirmed','rejected')),
  reviewed_by uuid references public.profiles(id),
  reviewed_at timestamptz,
  primary key (report_id, provision_node_id)
);

create table public.review_events (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null,
  entity_id uuid not null,
  action text not null,
  actor_id uuid references public.profiles(id),
  note text,
  created_at timestamptz not null default now()
);

create index source_items_published_at_idx on public.source_items (published_at desc);
create index source_items_pipeline_status_idx on public.source_items (pipeline_status);
create index draft_jobs_status_idx on public.draft_jobs (status, created_at);
create index reports_status_published_at_idx on public.reports (status, published_at desc);
create index provision_nodes_law_version_idx on public.provision_nodes (law_version_id);
create index comparison_cells_law_version_idx on public.comparison_cells (law_version_id);

alter table public.profiles enable row level security;
alter table public.team_memberships enable row level security;
alter table public.publishers enable row level security;
alter table public.sources enable row level security;
alter table public.source_items enable row level security;
alter table public.draft_jobs enable row level security;
alter table public.reports enable row level security;
alter table public.report_evidence enable row level security;
alter table public.legal_instruments enable row level security;
alter table public.law_versions enable row level security;
alter table public.provision_nodes enable row level security;
alter table public.criteria_sets enable row level security;
alter table public.criteria enable row level security;
alter table public.comparison_cells enable row level security;
alter table public.comparison_cell_provisions enable row level security;
alter table public.report_provision_links enable row level security;
alter table public.review_events enable row level security;

create policy profiles_self_select on public.profiles for select to authenticated
  using ((select auth.uid()) = id or (select private.is_team_member('reviewer')));
create policy profiles_self_update on public.profiles for update to authenticated
  using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

create policy team_memberships_self_or_admin_select on public.team_memberships for select to authenticated
  using (user_id = (select auth.uid()) or (select private.is_team_member('admin')));
create policy team_memberships_admin_manage on public.team_memberships for all to authenticated
  using ((select private.is_team_member('admin'))) with check ((select private.is_team_member('admin')));

create policy publishers_public_select on public.publishers for select to anon, authenticated using (is_active);
create policy publishers_team_manage on public.publishers for all to authenticated
  using ((select private.is_team_member('editor'))) with check ((select private.is_team_member('editor')));

create policy sources_public_select on public.sources for select to anon, authenticated using (is_active);
create policy sources_team_manage on public.sources for all to authenticated
  using ((select private.is_team_member('editor'))) with check ((select private.is_team_member('editor')));

create policy source_items_public_select on public.source_items for select to anon, authenticated
  using (pipeline_status = 'drafted' and relevance_status = 'relevant');
create policy source_items_team_manage on public.source_items for all to authenticated
  using ((select private.is_team_member('editor'))) with check ((select private.is_team_member('editor')));

create policy draft_jobs_team_manage on public.draft_jobs for all to authenticated
  using ((select private.is_team_member('editor'))) with check ((select private.is_team_member('editor')));

create policy reports_public_select on public.reports for select to anon, authenticated
  using (status = 'published');
create policy reports_team_manage on public.reports for all to authenticated
  using ((select private.is_team_member('editor'))) with check ((select private.is_team_member('editor')));

create policy report_evidence_public_select on public.report_evidence for select to anon, authenticated
  using (exists (select 1 from public.reports r where r.id = report_id and r.status = 'published'));
create policy report_evidence_team_manage on public.report_evidence for all to authenticated
  using ((select private.is_team_member('editor'))) with check ((select private.is_team_member('editor')));

create policy legal_instruments_public_select on public.legal_instruments for select to anon, authenticated using (is_published);
create policy legal_instruments_team_manage on public.legal_instruments for all to authenticated
  using ((select private.is_team_member('editor'))) with check ((select private.is_team_member('editor')));

create policy law_versions_public_select on public.law_versions for select to anon, authenticated
  using (status = 'published');
create policy law_versions_team_manage on public.law_versions for all to authenticated
  using ((select private.is_team_member('editor'))) with check ((select private.is_team_member('editor')));

create policy provision_nodes_public_select on public.provision_nodes for select to anon, authenticated
  using (translation_status = 'published' and exists (select 1 from public.law_versions lv where lv.id = law_version_id and lv.status = 'published'));
create policy provision_nodes_team_manage on public.provision_nodes for all to authenticated
  using ((select private.is_team_member('editor'))) with check ((select private.is_team_member('editor')));

create policy criteria_sets_public_select on public.criteria_sets for select to anon, authenticated using (is_published);
create policy criteria_sets_team_manage on public.criteria_sets for all to authenticated
  using ((select private.is_team_member('editor'))) with check ((select private.is_team_member('editor')));

create policy criteria_public_select on public.criteria for select to anon, authenticated
  using (exists (select 1 from public.criteria_sets cs where cs.id = criteria_set_id and cs.is_published));
create policy criteria_team_manage on public.criteria for all to authenticated
  using ((select private.is_team_member('editor'))) with check ((select private.is_team_member('editor')));

create policy comparison_cells_public_select on public.comparison_cells for select to anon, authenticated
  using (status = 'published');
create policy comparison_cells_team_manage on public.comparison_cells for all to authenticated
  using ((select private.is_team_member('editor'))) with check ((select private.is_team_member('editor')));

create policy comparison_cell_provisions_public_select on public.comparison_cell_provisions for select to anon, authenticated
  using (exists (select 1 from public.comparison_cells cc where cc.id = comparison_cell_id and cc.status = 'published'));
create policy comparison_cell_provisions_team_manage on public.comparison_cell_provisions for all to authenticated
  using ((select private.is_team_member('editor'))) with check ((select private.is_team_member('editor')));

create policy report_provision_links_public_select on public.report_provision_links for select to anon, authenticated
  using (confidence = 'confirmed' and exists (select 1 from public.reports r where r.id = report_id and r.status = 'published'));
create policy report_provision_links_team_manage on public.report_provision_links for all to authenticated
  using ((select private.is_team_member('editor'))) with check ((select private.is_team_member('editor')));

create policy review_events_team_select on public.review_events for select to authenticated
  using ((select private.is_team_member('reviewer')));
create policy review_events_team_insert on public.review_events for insert to authenticated
  with check ((select private.is_team_member('reviewer')));

grant select on all tables in schema public to anon, authenticated;
grant insert, update, delete on all tables in schema public to authenticated;
grant usage, select on all sequences in schema public to authenticated;
grant execute on all functions in schema public to anon, authenticated;
