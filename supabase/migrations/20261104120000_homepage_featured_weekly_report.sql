create table public.homepage_featured_weekly_reports (
 issue_key text primary key references public.written_weekly_issues(issue_key) on delete cascade,
 report_id uuid not null references public.reports(id) on delete cascade,
 updated_by uuid references auth.users(id) on delete set null,
 updated_at timestamptz not null default now(),
 constraint homepage_featured_weekly_report_in_issue foreign key(issue_key,report_id)
  references public.written_weekly_issue_reports(issue_key,report_id) on delete cascade
);

alter table public.homepage_featured_weekly_reports enable row level security;
revoke all on public.homepage_featured_weekly_reports from public,anon,authenticated;
grant select on public.homepage_featured_weekly_reports to anon,authenticated;
grant insert,update,delete on public.homepage_featured_weekly_reports to authenticated;

create policy homepage_featured_public_read on public.homepage_featured_weekly_reports
 for select to anon using(exists(select 1 from public.written_weekly_issues i where i.issue_key=homepage_featured_weekly_reports.issue_key and i.status='published'));
create policy homepage_featured_team_read on public.homepage_featured_weekly_reports
 for select to authenticated using(private.is_team_member('admin') or private.is_team_member('editor') or exists(select 1 from public.written_weekly_issues i where i.issue_key=homepage_featured_weekly_reports.issue_key and i.status='published'));
create policy homepage_featured_admin_insert on public.homepage_featured_weekly_reports
 for insert to authenticated with check(private.is_team_member('admin') and updated_by=(select auth.uid()));
create policy homepage_featured_admin_update on public.homepage_featured_weekly_reports
 for update to authenticated using(private.is_team_member('admin')) with check(private.is_team_member('admin') and updated_by=(select auth.uid()));
create policy homepage_featured_admin_delete on public.homepage_featured_weekly_reports
 for delete to authenticated using(private.is_team_member('admin'));

