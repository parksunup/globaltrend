-- All rows and trial publication below are rolled back. No audio object created.
begin;
do $$
declare admin_id uuid; report jsonb; job_id uuid; result jsonb;
begin
  if has_function_privilege('anon','public.podcast_cloud_step(text,text,uuid,jsonb)','execute')
     or has_function_privilege('authenticated','public.podcast_cloud_step(text,text,uuid,jsonb)','execute') then
    raise exception 'worker API exposed';
  end if;
  select user_id into strict admin_id from public.team_memberships where role='admin' and is_active limit 1;
  select jsonb_build_object('id',r.id,'title',r.title_ko,'summary',coalesce(r.one_line_summary_ko,''),'details',coalesce(r.detailed_summary_ko,''),
    'officialUrl',s.canonical_url,'officialDate',coalesce((s.published_at at time zone 'UTC')::date::text,''),'source','official')
    into strict report from public.reports r join public.source_items s on s.id=r.source_item_id where r.status='published' limit 1;
  update public.podcast_cloud_runtime set enabled=true,status='ready',last_seen_at=now();
  insert into public.podcast_production_jobs(issue_key,packet,source_hash,report_snapshot,created_by,execution_mode,auto_publish)
    values('2098-W01',jsonb_build_object('issueKey','2098-W01','title','Cloud rollback test','description','Disposable','weekStart','2098-01-01','weekEnd','2098-01-07','reportIds',jsonb_build_array(report->>'id')),
      'test',jsonb_build_array(report),admin_id,'cloud',true) returning id into job_id;
  perform set_config('request.jwt.claims','{"role":"service_role"}',true);
  set local role service_role;
  result=public.podcast_cloud_step('1:1','claim');
  if result->>'id' is distinct from job_id::text then raise exception 'claim mismatch'; end if;
  result=public.podcast_cloud_step('2:1','claim');
  if result is not null then raise exception 'double claim'; end if;
  perform public.podcast_cloud_step('1:1','checkpoint',job_id,'{"phase":"generating","checkpoint":{"stage":"watch","artifact_id":"original"}}');
  perform public.podcast_cloud_step('1:1','complete',job_id,jsonb_build_object('path','2098-W01/'||job_id||'.m4a','mime','audio/mp4','size',12));
  if (select phase from public.podcast_production_jobs where id=job_id)<>'published' then raise exception 'not published'; end if;
  if (select count(*) from public.weekly_podcast_episodes where issue_key='2098-W01')<>1 then raise exception 'publication mismatch'; end if;
  begin
    perform public.podcast_cloud_step('1:1','checkpoint',job_id,'{"phase":"generating","checkpoint":{}}');
    raise exception 'completed job regressed';
  exception when raise_exception then
    if sqlerrm<>'lease lost' then raise; end if;
  end;
  reset role;
end;
$$;
rollback;
