-- Public playback checks publication only; administrator checks apply only to signed-in users.
drop policy "public can play published podcast audio" on storage.objects;
create policy "public can play published podcast audio"
on storage.objects for select to anon,authenticated
using (bucket_id='weekly-podcasts' and exists (
 select 1 from public.weekly_podcast_episodes episode
 join public.weekly_issues issue on issue.issue_key=episode.issue_key
 where episode.audio_path=storage.objects.name and episode.status='published' and issue.status='published'
));
create policy "admins can inspect podcast audio"
on storage.objects for select to authenticated
using (bucket_id='weekly-podcasts' and private.is_team_member('admin'));
