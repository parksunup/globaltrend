-- Team-only, append-only comments on committed PR preview material.
-- A public Preview URL never grants permission to read or write feedback.
create table public.submission_feedback (
  id bigint generated always as identity primary key,
  branch_name text not null check (branch_name ~ '^[A-Za-z0-9._/-]{1,160}$'),
  item_id text not null check (item_id ~ '^[A-Za-z0-9._:-]{1,180}$'),
  commit_sha text not null check (commit_sha ~ '^[0-9a-f]{40}$'),
  body text not null check (char_length(btrim(body)) between 1 and 4000),
  author_id uuid not null default auth.uid() references public.profiles(id),
  created_at timestamptz not null default now()
);

create index submission_feedback_branch_item_created_idx
  on public.submission_feedback (branch_name, item_id, created_at desc);
create index submission_feedback_author_idx
  on public.submission_feedback (author_id);

alter table public.submission_feedback enable row level security;

create policy submission_feedback_team_read on public.submission_feedback
  for select to authenticated
  using ((select private.is_team_member('reviewer')));

create policy submission_feedback_team_insert on public.submission_feedback
  for insert to authenticated
  with check (
    author_id = (select auth.uid())
    and (select private.is_team_member('reviewer'))
  );

revoke all on public.submission_feedback from anon, authenticated;
grant select, insert (branch_name, item_id, commit_sha, body)
  on public.submission_feedback to authenticated;
grant usage, select on sequence public.submission_feedback_id_seq to authenticated;
