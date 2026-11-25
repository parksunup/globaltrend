-- Keep every superseded Codex proposal private when its resolution is saved.
create table team_workspace_private.trend_edit_history (
  report_id uuid not null references public.reports(id) on delete cascade,
  revision bigint not null,
  payload jsonb not null,
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null,
  primary key (report_id, revision)
);

alter table team_workspace_private.trend_edit_history enable row level security;
revoke all on team_workspace_private.trend_edit_history from public, anon, authenticated;

create function team_workspace_private.archive_trend_edit()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  insert into team_workspace_private.trend_edit_history (report_id, revision, payload, updated_by, updated_at)
  values (old.report_id, old.revision, old.payload, old.updated_by, old.updated_at);
  return new;
end;
$$;

revoke all on function team_workspace_private.archive_trend_edit() from public, anon, authenticated;

create trigger archive_trend_edit
before update on team_workspace_private.trend_edits
for each row
when (old.payload is distinct from new.payload)
execute function team_workspace_private.archive_trend_edit();
