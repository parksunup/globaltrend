-- Preserve cancelled attempts while allowing another production for that week.
alter table public.podcast_production_jobs drop constraint podcast_production_jobs_issue_key_key;
create unique index podcast_production_one_current_issue
  on public.podcast_production_jobs(issue_key) where phase <> 'cancelled';
