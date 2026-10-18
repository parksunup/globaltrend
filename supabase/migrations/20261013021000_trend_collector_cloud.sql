-- Additive only. Existing ingest/revision deduplication remains authoritative.
alter table public.reports add column if not exists source_item_revision_id uuid references public.source_item_revisions(id);
alter table public.reports add column if not exists instruction_version text;
alter table public.reports add column if not exists automation_metadata jsonb not null default '{}'::jsonb;
alter table public.draft_jobs add column if not exists proposed_draft jsonb;

create table public.collector_runs (
 id uuid primary key, started_at timestamptz not null, finished_at timestamptz not null,
 result jsonb not null check (jsonb_typeof(result)='object'), created_at timestamptz not null default now()
);
create table public.collector_progress (
 source_id uuid primary key references public.sources(id), last_success_date date,
 range_start date, range_end date, cursor jsonb, updated_at timestamptz not null default now()
);
create table public.collector_draft_daily_usage (
 day date primary key, claims integer not null default 0 check (claims between 0 and 10)
);
alter table public.collector_runs enable row level security;
alter table public.collector_progress enable row level security;
alter table public.collector_draft_daily_usage enable row level security;
revoke all on public.collector_runs,public.collector_progress,public.collector_draft_daily_usage from anon,authenticated;
grant select,insert,update on public.collector_runs,public.collector_progress,public.collector_draft_daily_usage to service_role;

create function public.collector_capacity() returns jsonb language sql security definer set search_path=pg_catalog,public as $$
 select jsonb_build_object('database_bytes',pg_database_size(current_database()),'stop_bytes',400000000,
 'can_write',pg_database_size(current_database())<400000000 and current_setting('default_transaction_read_only')='off');
$$;
create function public.collector_source_allowed(p_source_id uuid) returns boolean
language sql security definer set search_path=pg_catalog,public as $$
 select exists(select 1 from public.sources s where s.id=p_source_id and s.is_active and s.terms_reviewed_at is not null);
$$;
create function public.collector_record_run(p_run_id uuid,p_result jsonb) returns void
language plpgsql security definer set search_path=pg_catalog,public as $$
begin
 if jsonb_typeof(p_result)<>'object' or octet_length(p_result::text)>100000 then
   raise invalid_parameter_value using message='Bounded run result is required'; end if;
 if pg_database_size(current_database())>=400000000 then raise insufficient_resources using message='Storage cap reached'; end if;
 insert into public.collector_runs(id,started_at,finished_at,result)
 values(p_run_id,(p_result->>'started_at')::timestamptz,(p_result->>'finished_at')::timestamptz,p_result);
end; $$;
create function public.collector_get_progress(p_source_id uuid) returns jsonb
language sql security definer set search_path=pg_catalog,public as $$
 select coalesce((select to_jsonb(p) from public.collector_progress p where source_id=p_source_id),'{}'::jsonb);
$$;
create function public.collector_set_progress(p_source_id uuid,p_since date,p_until date,p_cursor jsonb,p_complete boolean) returns void
language plpgsql security definer set search_path=pg_catalog,public as $$
begin
 if p_until is null or (p_since is not null and p_since>p_until) or octet_length(coalesce(p_cursor::text,''))>4000 then
   raise invalid_parameter_value using message='Invalid progress range'; end if;
 insert into public.collector_progress(source_id,last_success_date,range_start,range_end,cursor)
 values(p_source_id,case when p_complete then p_until end,p_since,p_until,p_cursor)
 on conflict(source_id) do update set
 last_success_date=case when p_complete then greatest(public.collector_progress.last_success_date,p_until) else public.collector_progress.last_success_date end,
 range_start=p_since,range_end=p_until,cursor=p_cursor,updated_at=now();
end; $$;

create function public.claim_trend_draft_jobs(p_worker text,p_limit integer default 1) returns jsonb
language plpgsql security definer set search_path=pg_catalog,public as $$
declare v_day date=(now() at time zone 'Asia/Seoul')::date; v_used integer; v_job record; v_result jsonb='[]'::jsonb;
begin
 if nullif(btrim(p_worker),'') is null or length(p_worker)>160 or p_limit not between 1 and 10 then
   raise invalid_parameter_value using message='Bounded worker and batch are required'; end if;
 if pg_database_size(current_database())>=400000000 then return v_result; end if;
 insert into public.collector_draft_daily_usage(day) values(v_day) on conflict do nothing;
 select claims into v_used from public.collector_draft_daily_usage where day=v_day for update;
 for v_job in
   select j.id from public.draft_jobs j
   join public.source_items si on si.id=j.source_item_id
   join public.sources s on s.id=si.source_id
   join public.source_item_revisions r on r.id=j.source_item_revision_id
   where j.attempts<3 and j.source_item_revision_id=si.current_revision_id
    and s.is_active and s.terms_reviewed_at is not null and r.metadata->>'ai_ready'='true'
    and length(r.content_text) between 10 and 80000
    and (j.status in ('pending','failed') or (j.status='claimed' and j.lease_until<now()))
   order by j.created_at,j.id limit least(p_limit,10-v_used) for update of j skip locked
 loop
   update public.draft_jobs set status='claimed',claimed_by=p_worker,claimed_at=now(),lease_until=now()+interval '30 minutes',attempts=attempts+1,last_error=null,updated_at=now() where id=v_job.id;
   v_result=v_result || (select jsonb_build_array(jsonb_build_object('job_id',j.id,'revision_id',r.id,'input_hash',j.input_hash,
    'instruction_version',j.instruction_version,'lease_until',j.lease_until,'title_original',si.title_original,'official_url',si.canonical_url,
    'published_at',si.published_at,'content_text',r.content_text,'metadata',r.metadata,'source_name',s.name))
    from public.draft_jobs j join public.source_item_revisions r on r.id=j.source_item_revision_id
    join public.source_items si on si.id=j.source_item_id join public.sources s on s.id=si.source_id where j.id=v_job.id);
 end loop;
 update public.collector_draft_daily_usage set claims=claims+jsonb_array_length(v_result) where day=v_day;
 return v_result;
end; $$;

create function public.submit_trend_draft(p_job_id uuid,p_worker text,p_draft jsonb) returns jsonb
language plpgsql security definer set search_path=pg_catalog,public as $$
declare j public.draft_jobs; si public.source_items; r public.source_item_revisions; evidence jsonb; point jsonb; report_id uuid;
begin
 select * into j from public.draft_jobs where id=p_job_id for update;
 if not found or j.status<>'claimed' or j.claimed_by is distinct from p_worker or j.lease_until is null or j.lease_until<=now() then
   raise insufficient_privilege using message='Active job lease is required'; end if;
 select * into si from public.source_items where id=j.source_item_id for update;
 if si.current_revision_id is distinct from j.source_item_revision_id then
   update public.draft_jobs set status='cancelled',last_error='Input revision superseded',updated_at=now() where id=j.id;
   return jsonb_build_object('status','superseded'); end if;
 select * into r from public.source_item_revisions where id=j.source_item_revision_id;
 if not exists(select 1 from public.sources s where s.id=si.source_id and s.is_active and s.terms_reviewed_at is not null)
    or r.metadata->>'ai_ready' is distinct from 'true' then
   raise insufficient_privilege using message='Source approval was revoked'; end if;
 if r.content_hash is distinct from j.input_hash or j.instruction_version<>'trend-ko-v1' then
   raise invalid_parameter_value using message='Input hash or instruction mismatch'; end if;
 if pg_database_size(current_database())>=400000000 then raise insufficient_resources using message='Storage cap reached'; end if;
 if jsonb_typeof(p_draft)<>'object' or octet_length(p_draft::text)>100000
   or nullif(btrim(p_draft->>'title_ko'),'') is null or length(p_draft->>'title_ko')>500
   or nullif(btrim(p_draft->>'summary_ko'),'') is null or length(p_draft->>'summary_ko')>3000
   or nullif(btrim(p_draft->>'details_ko'),'') is null or length(p_draft->>'details_ko')>20000
   or jsonb_typeof(p_draft->'key_points') is distinct from 'array'
   or jsonb_typeof(p_draft->'evidence') is distinct from 'array'
   or jsonb_array_length(p_draft->'evidence') not between 1 and 30
   or jsonb_typeof(p_draft->'limitations') is distinct from 'array'
   or jsonb_typeof(p_draft->'jurisdictions') is distinct from 'array'
   or jsonb_typeof(p_draft->'topics') is distinct from 'array' then
   raise invalid_parameter_value using message='Required Korean draft fields are missing or oversized'; end if;
 for point in select value from jsonb_array_elements(p_draft->'key_points') loop
   if jsonb_typeof(point) is distinct from 'object' or jsonb_typeof(point->'text') is distinct from 'string'
     or nullif(btrim(point->>'text'),'') is null or length(point->>'text')>3000
     or coalesce(point->>'evidence_index','') !~ '^[0-9]{1,2}$' then
     raise invalid_parameter_value using message='Invalid key point or evidence index'; end if;
   if (point->>'evidence_index')::integer >= jsonb_array_length(p_draft->'evidence') then
     raise invalid_parameter_value using message='Invalid key point or evidence index'; end if;
 end loop;
 for evidence in select value from jsonb_array_elements(p_draft->'evidence') loop
   if length(coalesce(evidence->>'quote',''))<12 or position(evidence->>'quote' in r.content_text)=0
     or nullif(btrim(evidence->>'locator'),'') is null or nullif(btrim(evidence->>'claim'),'') is null then
     raise invalid_parameter_value using message='Evidence quote is missing from the exact revision'; end if;
 end loop;
 -- Any pre-existing report may contain human work; never replace it automatically.
 if exists(select 1 from public.reports where source_item_id=si.id) then
   update public.draft_jobs set status='needs_human_review',proposed_draft=p_draft,last_error='Existing report preserved; proposed revision requires human review',lease_until=null,updated_at=now() where id=j.id;
   return jsonb_build_object('status','needs_human_review'); end if;
 insert into public.reports(source_item_id,source_item_revision_id,instruction_version,title_ko,one_line_summary_ko,detailed_summary_ko,
 key_points,policy_implications_ko,jurisdictions,topics,status,human_reviewed,codex_run_id,automation_metadata)
 values(si.id,r.id,j.instruction_version,p_draft->>'title_ko',p_draft->>'summary_ko',p_draft->>'details_ko',p_draft->'key_points',
 p_draft->>'policy_implications_ko',array(select jsonb_array_elements_text(p_draft->'jurisdictions')),
 array(select jsonb_array_elements_text(p_draft->'topics')),'draft',false,p_worker,
 jsonb_build_object('job_id',j.id,'written_at',now(),'ai_check_status','evidence_structurally_checked_only',
 'limitations',p_draft->'limitations','source_metadata',r.metadata)) returning id into report_id;
 for evidence in select value from jsonb_array_elements(p_draft->'evidence') loop
  insert into public.report_evidence(report_id,source_item_id,locator,excerpt)
  values(report_id,si.id,jsonb_build_object('location',evidence->>'locator','claim',evidence->>'claim','revision_id',r.id),evidence->>'quote') on conflict do nothing;
 end loop;
 update public.draft_jobs set status='submitted',proposed_draft=p_draft,lease_until=null,updated_at=now() where id=j.id;
 update public.source_items set pipeline_status='drafted',relevance_status='needs_review',updated_at=now() where id=si.id;
 return jsonb_build_object('status','draft','report_id',report_id);
end; $$;

create function public.fail_trend_draft(p_job_id uuid,p_worker text,p_error text) returns void
language plpgsql security definer set search_path=pg_catalog,public as $$
begin
 update public.draft_jobs set status='failed',last_error=left(p_error,1000),lease_until=null,updated_at=now()
 where id=p_job_id and status='claimed' and claimed_by=p_worker and lease_until>now();
 if not found then raise insufficient_privilege using message='Active job lease is required'; end if;
end; $$;

-- Narrow authenticated projection: raw DB tables are never opened to anonymous users.
create function public.get_trend_collector_review() returns jsonb
language plpgsql security definer set search_path=pg_catalog,public,private as $$
declare result jsonb;
begin
 if not private.is_team_member('reviewer') then raise insufficient_privilege using message='Active reviewer membership is required'; end if;
 select coalesce(jsonb_agg(x),'[]'::jsonb) into result from (
  select si.id,si.title_original,si.canonical_url,si.published_at,s.name as source_name,si.current_revision_id,
  si.pipeline_status,si.relevance_status,si.metadata,
  (select r.content_text from public.source_item_revisions r where r.id=si.current_revision_id) as current_content_text,
  (select r.content_text from public.source_item_revisions r join public.reports report on report.source_item_revision_id=r.id where report.source_item_id=si.id) as report_content_text,
  (select coalesce(jsonb_agg(to_jsonb(j)||jsonb_build_object('input_content_text',rev.content_text)),'[]'::jsonb) from public.draft_jobs j left join public.source_item_revisions rev on rev.id=j.source_item_revision_id where j.source_item_id=si.id) as jobs,
  (select to_jsonb(r) from public.reports r where r.source_item_id=si.id) as report,
  (select coalesce(jsonb_agg(to_jsonb(e)),'[]'::jsonb) from public.report_evidence e join public.reports r on e.report_id=r.id where r.source_item_id=si.id) as evidence
  from public.source_items si join public.sources s on s.id=si.source_id
  where si.current_revision_id is not null or si.metadata ? 'fetch_failure'
  order by si.discovered_at desc,si.id limit 100
 ) x;
 return jsonb_build_object('items',result,'limit',100,'database_bytes',pg_database_size(current_database()));
end; $$;

revoke all on function public.collector_capacity(),public.collector_source_allowed(uuid),public.collector_record_run(uuid,jsonb),public.collector_get_progress(uuid),
 public.collector_set_progress(uuid,date,date,jsonb,boolean),public.claim_trend_draft_jobs(text,integer),
 public.submit_trend_draft(uuid,text,jsonb),public.fail_trend_draft(uuid,text,text) from public,anon,authenticated;
grant execute on function public.collector_capacity(),public.collector_source_allowed(uuid),public.collector_record_run(uuid,jsonb),public.collector_get_progress(uuid),
 public.collector_set_progress(uuid,date,date,jsonb,boolean),public.claim_trend_draft_jobs(text,integer),
 public.submit_trend_draft(uuid,text,jsonb),public.fail_trend_draft(uuid,text,text) to service_role;
revoke all on function public.get_trend_collector_review() from public,anon;
grant execute on function public.get_trend_collector_review() to authenticated;
