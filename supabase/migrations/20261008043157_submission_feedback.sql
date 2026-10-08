-- Public, append-only feedback on committed PR preview material.
-- Anonymous visitors can submit but cannot read, update, or delete comments.
create table if not exists public.submission_feedback (
  id bigint generated always as identity primary key,
  branch_name text not null check (branch_name ~ '^[A-Za-z0-9._/-]{1,160}$'),
  item_id text not null check (item_id ~ '^[A-Za-z0-9._:-]{1,180}$'),
  commit_sha text not null check (commit_sha ~ '^[0-9a-f]{40}$'),
  body text not null check (char_length(btrim(body)) between 1 and 4000),
  author_name text not null default '익명' check (char_length(btrim(author_name)) between 1 and 80),
  created_at timestamptz not null default now()
);

create index if not exists submission_feedback_branch_item_created_idx
  on public.submission_feedback (branch_name, item_id, created_at desc);
alter table public.submission_feedback enable row level security;

drop policy if exists submission_feedback_team_read on public.submission_feedback;
create policy submission_feedback_team_read on public.submission_feedback
  for select to authenticated
  using ((select private.is_team_member('reviewer')));

drop policy if exists submission_feedback_public_insert on public.submission_feedback;
create policy submission_feedback_public_insert on public.submission_feedback
  for insert to anon, authenticated
  with check (true);

revoke all on public.submission_feedback from anon, authenticated;
grant select on public.submission_feedback to authenticated;
grant insert (branch_name, item_id, commit_sha, author_name, body)
  on public.submission_feedback to anon, authenticated;
grant usage on sequence public.submission_feedback_id_seq to anon, authenticated;
