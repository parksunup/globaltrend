-- Feedback submitted on public review pages is publicly readable.
drop policy if exists submission_feedback_team_read on public.submission_feedback;
drop policy if exists submission_feedback_public_read on public.submission_feedback;
create policy submission_feedback_public_read on public.submission_feedback
  for select to anon, authenticated using (true);
grant select on public.submission_feedback to anon, authenticated;
