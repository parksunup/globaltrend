create table public.weekly_issues (
  issue_key text primary key check (issue_key ~ '^[0-9]{4}-W(0[1-9]|[1-4][0-9]|5[0-3])$'),
  title text not null check (char_length(btrim(title)) between 1 and 160),
  description text not null default '' check (char_length(description) <= 1000),
  week_start date not null,
  week_end date not null,
  status text not null default 'published' check (status in ('draft','published','withdrawn')),
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  published_at timestamptz,
  check (week_start <= week_end),
  check ((status = 'published') = (published_at is not null))
);

create table public.weekly_issue_reports (
  issue_key text not null references public.weekly_issues(issue_key) on delete cascade,
  report_id uuid not null references public.reports(id) on delete restrict,
  sort_order integer not null check (sort_order >= 0),
  primary key (issue_key, report_id),
  unique (issue_key, sort_order)
);

create table public.weekly_podcast_episodes (
  issue_key text primary key references public.weekly_issues(issue_key) on delete restrict,
  audio_path text not null unique,
  audio_mime_type text not null check (audio_mime_type in ('audio/mpeg','audio/wav','audio/mp4','audio/x-m4a')),
  file_size_bytes bigint not null check (file_size_bytes > 0 and file_size_bytes <= 52428800),
  status text not null default 'published' check (status in ('published','withdrawn')),
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  published_at timestamptz not null default now()
);

alter table public.weekly_issues enable row level security;
alter table public.weekly_issue_reports enable row level security;
alter table public.weekly_podcast_episodes enable row level security;

revoke all on public.weekly_issues from anon, authenticated;
revoke all on public.weekly_issue_reports from anon, authenticated;
revoke all on public.weekly_podcast_episodes from anon, authenticated;

grant select(issue_key,title,description,week_start,week_end,published_at,created_at)
  on public.weekly_issues to anon;
grant select(issue_key,report_id,sort_order)
  on public.weekly_issue_reports to anon;
grant select(issue_key,audio_path,audio_mime_type,file_size_bytes,published_at,created_at)
  on public.weekly_podcast_episodes to anon;
grant select,insert,update,delete on public.weekly_issues to authenticated;
grant select,insert,update,delete on public.weekly_issue_reports to authenticated;
grant select,insert,update,delete on public.weekly_podcast_episodes to authenticated;

create policy "published weekly issues are public"
  on public.weekly_issues for select to anon
  using (status = 'published');
create policy "team can read weekly issues"
  on public.weekly_issues for select to authenticated
  using (status = 'published' or private.is_team_member('admin'));
create policy "admins manage weekly issues"
  on public.weekly_issues for all to authenticated
  using (private.is_team_member('admin'))
  with check (private.is_team_member('admin'));

create policy "published issue contents are public"
  on public.weekly_issue_reports for select to anon
  using (exists (
    select 1 from public.weekly_issues issue
    where issue.issue_key = weekly_issue_reports.issue_key and issue.status = 'published'
  ));
create policy "team can read issue contents"
  on public.weekly_issue_reports for select to authenticated
  using (
    private.is_team_member('admin')
    or exists (
      select 1 from public.weekly_issues issue
      where issue.issue_key = weekly_issue_reports.issue_key and issue.status = 'published'
    )
  );
create policy "admins manage issue contents"
  on public.weekly_issue_reports for all to authenticated
  using (private.is_team_member('admin'))
  with check (private.is_team_member('admin'));

create policy "published podcasts are public"
  on public.weekly_podcast_episodes for select to anon
  using (
    status = 'published' and exists (
      select 1 from public.weekly_issues issue
      where issue.issue_key = weekly_podcast_episodes.issue_key and issue.status = 'published'
    )
  );
create policy "team can read podcasts"
  on public.weekly_podcast_episodes for select to authenticated
  using (
    private.is_team_member('admin')
    or (status = 'published' and exists (
      select 1 from public.weekly_issues issue
      where issue.issue_key = weekly_podcast_episodes.issue_key and issue.status = 'published'
    ))
  );
create policy "admins manage podcasts"
  on public.weekly_podcast_episodes for all to authenticated
  using (private.is_team_member('admin'))
  with check (private.is_team_member('admin'));

create or replace function public.publish_weekly_podcast_issue(
  p_issue_key text,
  p_title text,
  p_description text,
  p_week_start date,
  p_week_end date,
  p_report_ids uuid[],
  p_audio_path text,
  p_audio_mime_type text,
  p_file_size_bytes bigint
) returns void
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_report_count bigint;
  v_extension text;
begin
  if auth.uid() is null or not private.is_team_member('admin') then
    raise exception 'admin role required' using errcode = '42501';
  end if;
  if p_issue_key !~ '^[0-9]{4}-W(0[1-9]|[1-4][0-9]|5[0-3])$'
     or nullif(btrim(p_title), '') is null or char_length(p_title) > 160
     or char_length(coalesce(p_description, '')) > 1000
     or p_week_start is null or p_week_end is null or p_week_start > p_week_end
     or coalesce(cardinality(p_report_ids), 0) not between 1 and 20
     or p_file_size_bytes not between 1 and 52428800
     or p_audio_mime_type not in ('audio/mpeg','audio/wav','audio/mp4','audio/x-m4a') then
    raise exception 'invalid weekly issue or podcast data' using errcode = '22023';
  end if;
  if (select count(distinct report_id) from unnest(p_report_ids) as ids(report_id))
     <> cardinality(p_report_ids) then
    raise exception 'duplicate report IDs are not allowed' using errcode = '22023';
  end if;
  select count(*) into v_report_count
    from public.reports r
    where r.id = any(p_report_ids) and r.status = 'published';
  if v_report_count <> cardinality(p_report_ids) then
    raise exception 'all included reports must already be published' using errcode = '22023';
  end if;

  v_extension := case
    when p_audio_mime_type = 'audio/mpeg' then 'mp3'
    when p_audio_mime_type = 'audio/wav' then 'wav'
    else 'm4a'
  end;
  if p_audio_path !~ ('^' || p_issue_key || '/[0-9a-f-]{36}\.' || v_extension || '$') then
    raise exception 'invalid audio path' using errcode = '22023';
  end if;

  insert into public.weekly_issues (
    issue_key, title, description, week_start, week_end, status, created_by, published_at
  ) values (
    p_issue_key, btrim(p_title), coalesce(p_description, ''), p_week_start, p_week_end,
    'published', auth.uid(), now()
  );

  insert into public.weekly_issue_reports (issue_key, report_id, sort_order)
    select p_issue_key, ids.report_id, (ids.ordinality - 1)::integer
    from unnest(p_report_ids) with ordinality as ids(report_id, ordinality);

  insert into public.weekly_podcast_episodes (
    issue_key, audio_path, audio_mime_type, file_size_bytes, status, created_by, published_at
  ) values (
    p_issue_key, p_audio_path, p_audio_mime_type, p_file_size_bytes,
    'published', auth.uid(), now()
  );
end;
$$;

revoke all on function public.publish_weekly_podcast_issue(text,text,text,date,date,uuid[],text,text,bigint) from public, anon;
grant execute on function public.publish_weekly_podcast_issue(text,text,text,date,date,uuid[],text,text,bigint) to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('weekly-podcasts','weekly-podcasts',false,52428800,array['audio/mpeg','audio/wav','audio/mp4','audio/x-m4a'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy "public can play published podcast audio"
  on storage.objects for select to anon, authenticated
  using (
    bucket_id = 'weekly-podcasts'
    and (
      private.is_team_member('admin')
      or exists (
        select 1 from public.weekly_podcast_episodes episode
        join public.weekly_issues issue on issue.issue_key = episode.issue_key
        where episode.audio_path = storage.objects.name
          and episode.status = 'published'
          and issue.status = 'published'
      )
    )
  );
create policy "admins upload podcast audio"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'weekly-podcasts' and private.is_team_member('admin'));
create policy "admins remove podcast audio"
  on storage.objects for delete to authenticated
  using (bucket_id = 'weekly-podcasts' and private.is_team_member('admin'));
