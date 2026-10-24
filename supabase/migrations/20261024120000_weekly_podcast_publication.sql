create table public.weekly_podcast_episodes (
  issue_key text primary key check (issue_key ~ '^[0-9]{4}-W[0-9]{2}$'),
  title text not null,
  description text not null default '',
  week_start date not null,
  week_end date not null,
  report_ids uuid[] not null check (cardinality(report_ids) > 0),
  audio_path text not null unique,
  audio_mime_type text not null check (audio_mime_type in ('audio/mpeg','audio/wav','audio/mp4','audio/x-m4a')),
  file_size_bytes bigint not null check (file_size_bytes > 0 and file_size_bytes <= 52428800),
  status text not null default 'published' check (status in ('draft','published','withdrawn')),
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  published_at timestamptz,
  check (week_start <= week_end),
  check ((status = 'published') = (published_at is not null))
);

alter table public.weekly_podcast_episodes enable row level security;
revoke all on public.weekly_podcast_episodes from anon, authenticated;
grant select(issue_key,title,description,week_start,week_end,report_ids,audio_path,audio_mime_type,file_size_bytes,published_at,created_at)
  on public.weekly_podcast_episodes to anon;
grant select,insert,update,delete on public.weekly_podcast_episodes to authenticated;

create policy "published podcast episodes are public"
  on public.weekly_podcast_episodes for select to anon
  using (status = 'published');
create policy "team can read podcast episodes"
  on public.weekly_podcast_episodes for select to authenticated
  using (status = 'published' or private.is_team_member('admin'));
create policy "admins manage podcast episodes"
  on public.weekly_podcast_episodes for all to authenticated
  using (private.is_team_member('admin'))
  with check (private.is_team_member('admin'));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('weekly-podcasts','weekly-podcasts',true,52428800,array['audio/mpeg','audio/wav','audio/mp4','audio/x-m4a'])
on conflict (id) do update set public = true, file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy "public can play published podcast audio"
  on storage.objects for select to anon, authenticated
  using (
    bucket_id = 'weekly-podcasts'
    and (
      private.is_team_member('admin')
      or exists (
        select 1 from public.weekly_podcast_episodes episode
        where episode.audio_path = storage.objects.name
          and episode.status = 'published'
      )
    )
  );
create policy "admins upload podcast audio"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'weekly-podcasts' and private.is_team_member('admin'));
create policy "admins remove podcast audio"
  on storage.objects for delete to authenticated
  using (bucket_id = 'weekly-podcasts' and private.is_team_member('admin'));
