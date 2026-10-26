-- Integration check against existing published data. Every write is rolled back.
begin;
do $$
declare
  actor uuid; r public.reports; s public.source_items; job_id uuid = gen_random_uuid();
  packet jsonb; snapshot jsonb; caught boolean = false;
begin
  select user_id into strict actor from public.team_memberships where role='admin' and is_active limit 1;
  select * into strict r from public.reports where status='published' limit 1;
  select * into strict s from public.source_items where id=r.source_item_id;
  perform set_config('request.jwt.claims', json_build_object('sub',actor,'role','authenticated')::text,true);
  packet=jsonb_build_object('reportIds',jsonb_build_array(r.id),'title','국제요정 트랜잭션 시험',
    'description','','weekStart','2099-01-01','weekEnd','2099-01-07');
  snapshot=jsonb_build_array(jsonb_build_object('id',r.id,'title',r.title_ko,
    'summary',coalesce(r.one_line_summary_ko,''),'details',coalesce(r.detailed_summary_ko,''),
    'officialUrl',s.canonical_url,'officialDate',coalesce((s.published_at at time zone 'UTC')::date::text,'')));
  insert into public.podcast_production_jobs(id,issue_key,packet,source_hash,report_snapshot,created_by)
    values(job_id,'2099-W01',packet,'test',snapshot,actor);
  begin perform public.publish_podcast_production_job(job_id);
  exception when sqlstate '22023' then caught=true; end;
  if not caught then raise exception 'unready audio was published'; end if;
  update public.podcast_production_jobs set phase='ready',audio_path='2099-W01/'||job_id||'.mp3',
    audio_mime_type='audio/mpeg',file_size_bytes=1,
    report_snapshot=jsonb_set(snapshot,'{0,title}','"changed title"') where id=job_id;
  caught=false;
  begin perform public.publish_podcast_production_job(job_id);
  exception when sqlstate '22023' then caught=true; end;
  if not caught then raise exception 'changed source was published'; end if;
  update public.podcast_production_jobs set report_snapshot=snapshot where id=job_id;
  perform public.publish_podcast_production_job(job_id);
  perform public.publish_podcast_production_job(job_id);
  if (select count(*) from public.weekly_issues where issue_key='2099-W01')<>1
     or (select count(*) from public.weekly_issue_reports where issue_key='2099-W01')<>1
     or (select count(*) from public.weekly_podcast_episodes where issue_key='2099-W01')<>1
     or (select phase from public.podcast_production_jobs where id=job_id)<>'published' then
    raise exception 'atomic or repeat-safe publication failed';
  end if;
  perform set_config('request.jwt.claims','{}',true);
  caught=false;
  begin perform public.publish_podcast_production_job(job_id);
  exception when insufficient_privilege then caught=true; end;
  if not caught then raise exception 'unauthenticated publication was accepted'; end if;
end;
$$;
rollback;
select 'unready blocked / source changes blocked / publication atomic / repeat safe / anonymous blocked / all writes rolled back' as result;
