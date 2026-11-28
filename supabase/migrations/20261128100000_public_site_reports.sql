create table if not exists public.site_reports (
  id bigint generated always as identity primary key,
  kind text not null check (kind in ('feedback', 'bug')),
  page_url text not null check (char_length(page_url) between 1 and 1000),
  body text not null check (char_length(btrim(body)) between 10 and 4000),
  contact_email text check (contact_email is null or char_length(contact_email) <= 254),
  status text not null default 'new' check (status in ('new', 'reviewing', 'resolved')),
  created_at timestamptz not null default now()
);

create index if not exists site_reports_created_at_idx on public.site_reports (created_at desc);
alter table public.site_reports enable row level security;

create policy site_reports_public_insert on public.site_reports
  for insert to anon, authenticated
  with check (status = 'new');

create policy site_reports_team_read on public.site_reports
  for select to authenticated
  using ((select private.is_team_member('reviewer')));

revoke all on public.site_reports from anon, authenticated;
grant insert (kind, page_url, body, contact_email) on public.site_reports to anon, authenticated;
grant select on public.site_reports to authenticated;
grant usage on sequence public.site_reports_id_seq to anon, authenticated;
