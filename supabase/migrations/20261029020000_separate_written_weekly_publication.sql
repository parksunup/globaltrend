-- Written weekly editions have their own identity and publication lifecycle.
-- Podcast metadata remains in the legacy weekly tables; no published audio is changed.
create table public.written_weekly_issues (
 issue_key text primary key check(issue_key ~ '^[0-9]{4}-W(0[1-9]|[1-4][0-9]|5[0-3])$'),
 title text not null check(length(btrim(title)) between 1 and 160),
 description text not null default '',week_start date not null,week_end date not null,
 status text not null default 'draft' check(status in ('draft','published','withdrawn')),
 created_by uuid references auth.users(id),created_at timestamptz not null default now(),published_at timestamptz,
 selection_notes jsonb not null default '[]'::jsonb check(jsonb_typeof(selection_notes)='array'),
 check(week_start<=week_end),check((status='published')=(published_at is not null))
);
create table public.written_weekly_issue_reports (
 issue_key text not null references public.written_weekly_issues(issue_key) on delete cascade,
 report_id uuid not null references public.reports(id) on delete restrict,
 sort_order integer not null check(sort_order>=0),primary key(issue_key,report_id),unique(issue_key,sort_order)
);
alter table public.written_weekly_issues enable row level security;
alter table public.written_weekly_issue_reports enable row level security;
revoke all on public.written_weekly_issues,public.written_weekly_issue_reports from public,anon,authenticated;
grant select(issue_key,title,description,week_start,week_end,status,published_at,created_at) on public.written_weekly_issues to anon;
grant select on public.written_weekly_issue_reports to anon;
grant select,insert,update,delete on public.written_weekly_issues,public.written_weekly_issue_reports to authenticated,service_role;
create policy written_issues_public_read on public.written_weekly_issues for select to anon using(status='published');
create policy written_issues_team_read on public.written_weekly_issues for select to authenticated using(status='published' or private.is_team_member('admin') or private.is_team_member('editor'));
create policy written_issues_admin_write on public.written_weekly_issues for all to authenticated using(private.is_team_member('admin')) with check(private.is_team_member('admin'));
create policy written_reports_public_read on public.written_weekly_issue_reports for select to anon using(exists(select 1 from public.written_weekly_issues i where i.issue_key=written_weekly_issue_reports.issue_key and i.status='published'));
create policy written_reports_team_read on public.written_weekly_issue_reports for select to authenticated using(private.is_team_member('admin') or private.is_team_member('editor') or exists(select 1 from public.written_weekly_issues i where i.issue_key=written_weekly_issue_reports.issue_key and i.status='published'));
create policy written_reports_admin_write on public.written_weekly_issue_reports for all to authenticated using(private.is_team_member('admin')) with check(private.is_team_member('admin'));
-- Only editor-created selections are copied. Podcast-only rows have empty selection_notes.
insert into public.written_weekly_issues(issue_key,title,description,week_start,week_end,status,created_by,created_at,published_at,selection_notes)
 select issue_key,title,description,week_start,week_end,status,created_by,created_at,published_at,selection_notes from public.weekly_issues where jsonb_array_length(selection_notes)>0;
insert into public.written_weekly_issue_reports(issue_key,report_id,sort_order)
 select r.issue_key,r.report_id,r.sort_order from public.weekly_issue_reports r join public.written_weekly_issues w on w.issue_key=r.issue_key;

create or replace function public.save_written_weekly_draft(p_issue_key text,p_title text,p_start date,p_end date,p_selection jsonb)
returns text language plpgsql security invoker set search_path=public,pg_temp as $$
declare n integer; entry jsonb;
begin
 if current_user not in ('postgres','service_role') and not coalesce(private.is_team_member('admin'),false) then raise exception 'admin or producer required' using errcode='42501'; end if;
 if p_issue_key !~ '^[0-9]{4}-W(0[1-9]|[1-4][0-9]|5[0-3])$' or nullif(trim(p_title),'') is null or length(p_title)>160 or p_start is null or p_end is null or p_end<>p_start+6 or extract(isodow from p_start)<>1 or p_issue_key<>to_char(p_start,'IYYY-"W"IW') or jsonb_typeof(p_selection) is distinct from 'array' then raise exception 'invalid weekly issue'; end if;
 n=jsonb_array_length(p_selection);
 if n<1 or n>8 or (select count(distinct value->>'report_id') from jsonb_array_elements(p_selection))<>n then raise exception 'invalid or duplicate selection'; end if;
 for entry in select value from jsonb_array_elements(p_selection) loop
  if nullif(trim(entry->>'reason'),'') is null or not exists(select 1 from reports r join source_items i on i.id=r.source_item_id where r.id=(entry->>'report_id')::uuid and r.status in ('draft','in_review','approved','published') and (i.published_at at time zone 'Asia/Seoul')::date between p_start and p_end) then raise exception 'report unavailable or outside week'; end if;
 end loop;
 if (select count(distinct r.source_item_id) from reports r where r.id in(select (value->>'report_id')::uuid from jsonb_array_elements(p_selection)))<>n then raise exception 'duplicate source item'; end if;
 insert into written_weekly_issues(issue_key,title,week_start,week_end,status,published_at,selection_notes) values(p_issue_key,p_title,p_start,p_end,'draft',null,p_selection)
 on conflict(issue_key) do nothing;
 perform 1 from written_weekly_issues where issue_key=p_issue_key for update;
 if exists(select 1 from written_weekly_issues where issue_key=p_issue_key and status<>'draft') then raise exception 'published issue cannot be replaced'; end if;
 update written_weekly_issues set title=p_title,week_start=p_start,week_end=p_end,selection_notes=p_selection where issue_key=p_issue_key;
 delete from written_weekly_issue_reports where issue_key=p_issue_key;
 insert into written_weekly_issue_reports(issue_key,report_id,sort_order) select p_issue_key,(value->>'report_id')::uuid,ordinality-1 from jsonb_array_elements(p_selection) with ordinality;
 return p_issue_key;
end; $$;


create or replace function public.publish_written_weekly_issue(p_issue_key text) returns void language plpgsql security invoker set search_path=public,pg_temp as $$
begin
 if not coalesce(private.is_team_member('admin'),false) then raise exception 'admin required' using errcode='42501'; end if;
 perform 1 from written_weekly_issues where issue_key=p_issue_key and status='draft' for update;
 if not found then raise exception 'draft issue required'; end if;
 if not exists(select 1 from written_weekly_issue_reports where issue_key=p_issue_key) or exists(select 1 from written_weekly_issue_reports w join reports r on r.id=w.report_id where w.issue_key=p_issue_key and (r.status<>'published' or not r.human_reviewed)) then raise exception 'all selected reports must be reviewed and published'; end if;
 update written_weekly_issues set status='published',published_at=now() where issue_key=p_issue_key;
end; $$;
revoke all on function public.publish_written_weekly_issue(text) from public;
grant execute on function public.publish_written_weekly_issue(text) to authenticated;

revoke all on function public.save_written_weekly_draft(text,text,date,date,jsonb) from public,anon,authenticated,service_role;
grant execute on function public.save_written_weekly_draft(text,text,date,date,jsonb) to authenticated,service_role;
revoke all on function public.publish_written_weekly_issue(text) from public,anon,authenticated,service_role;
grant execute on function public.publish_written_weekly_issue(text) to authenticated;
