begin;
set local search_path = public, extensions;
select plan(3);
select ok(private.trend_draft_source_allowed((select id from public.sources where name='Freevacy Privacy Newsfeed')),
  'project-lead-approved Freevacy source allows individual drafts');
select ok(private.trend_draft_source_allowed((select id from public.sources where name='noyb — European Center for Digital Rights')),
  'project-lead-approved noyb source allows individual drafts');
select ok(private.trend_draft_source_allowed((select id from public.sources where name='overview.legal')),
  'project-lead-approved overview.legal source allows individual drafts');
select * from finish();
rollback;
