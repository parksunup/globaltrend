-- A daily producer may finish only after every collected item in its KST
-- window has either a Korean workspace draft or an explicit irrelevant decision.

create or replace function public.collector_daily_pipeline_status(
  p_since date,
  p_until date
) returns jsonb
language plpgsql
stable
security invoker
set search_path=public,pg_temp
as $$
declare
  gap_count integer;
  retained_unfinished integer;
  gaps jsonb;
begin
  if p_since is null or p_until is null or p_until < p_since
     or p_until - p_since > 14 then
    raise invalid_parameter_value using message='A bounded daily pipeline window is required';
  end if;

  select count(*),
         coalesce(
           jsonb_agg(
             jsonb_build_object(
               'item_id',g.item_id,
               'job_id',g.job_id,
               'job_status',g.job_status,
               'reason',g.reason
             )
             order by g.item_id
           ),
           '[]'::jsonb
         )
    into gap_count,gaps
    from public.collector_completion_gaps(p_since,p_until) g;

  select count(*)::integer
    into retained_unfinished
    from public.source_items i
   where i.metadata->>'retention_decision'='keep'
     and not exists(
       select 1
         from public.reports r
        where r.source_item_id=i.id
          and r.status in ('draft','in_review','approved','published')
          and nullif(btrim(r.title_ko),'') is not null
          and nullif(btrim(r.one_line_summary_ko),'') is not null
          and nullif(btrim(r.detailed_summary_ko),'') is not null
     );

  return jsonb_build_object(
    'since',p_since,
    'until',p_until,
    'completion_gap_count',gap_count,
    'retained_drafts_unfinished',retained_unfinished,
    'ready_to_complete',gap_count=0 and retained_unfinished=0,
    'gaps',gaps
  );
end;
$$;

revoke all on function public.collector_daily_pipeline_status(date,date)
from public,anon,authenticated,service_role;
grant execute on function public.collector_daily_pipeline_status(date,date)
to service_role;

create or replace function private.guard_producer_completion()
returns trigger
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  since_date date;
  until_date date;
  status jsonb;
begin
  if new.trigger_kind<>'cloud-automation-summary'
     or new.result->>'role'<>'daily-producer' then
    return new;
  end if;

  begin
    since_date=coalesce(
      new.result#>>'{target_window_kst,from_inclusive}',
      new.result#>>'{target_window_kst,from}',
      new.result->>'since'
    )::date;
    until_date=coalesce(
      new.result#>>'{target_window_kst,through_inclusive}',
      new.result#>>'{target_window_kst,through}',
      new.result->>'until'
    )::date;
    status=public.collector_daily_pipeline_status(since_date,until_date);
  exception
    when others then
      new.result=new.result||jsonb_build_object(
        'status','partial',
        'completion_blocked','daily_pipeline_window_missing_or_invalid',
        'completion_guard_error',sqlerrm
      );
      return new;
  end;

  new.result=new.result||jsonb_build_object(
    'completion_gap_count',(status->>'completion_gap_count')::integer,
    'retained_drafts_unfinished',(status->>'retained_drafts_unfinished')::integer,
    'pipeline_ready_to_complete',(status->>'ready_to_complete')::boolean
  );

  if not (status->>'ready_to_complete')::boolean then
    new.result=new.result||jsonb_build_object(
      'status','partial',
      'completion_blocked','korean_draft_or_relevance_decision_pending'
    );
  end if;
  return new;
end;
$$;

revoke all on function private.guard_producer_completion()
from public,anon,authenticated;

drop trigger if exists guard_retained_draft_completion
on public.collector_edge_events;
create trigger guard_retained_draft_completion
before insert or update of result
on public.collector_edge_events
for each row execute function private.guard_producer_completion();

create or replace function public.collector_finalize_daily_producer(
  p_execution_id text,
  p_started_at timestamptz,
  p_finished_at timestamptz,
  p_since date,
  p_until date,
  p_result jsonb
) returns jsonb
language plpgsql
security invoker
set search_path=public,pg_temp
as $$
declare
  event_id uuid;
  final_result jsonb;
begin
  if nullif(btrim(p_execution_id),'') is null
     or length(p_execution_id)>200
     or p_started_at is null
     or p_finished_at is null
     or p_finished_at<p_started_at
     or p_since is null
     or p_until is null
     or p_until<p_since
     or p_until-p_since>14
     or p_result is null then
    raise invalid_parameter_value using message='Valid bounded daily producer summary is required';
  end if;

  p_result=p_result||jsonb_build_object(
    'role','daily-producer',
    'target_window_kst',jsonb_build_object(
      'from_inclusive',p_since,
      'through_inclusive',p_until
    )
  );

  select e.id
    into event_id
    from public.collector_edge_events e
   where e.source_id is null
     and e.execution_id=p_execution_id
     and e.trigger_kind='cloud-automation-summary'
     and e.result->>'role'='daily-producer'
   order by e.started_at desc,e.id
   limit 1
   for update;

  if event_id is null then
    insert into public.collector_edge_events(
      source_id,execution_id,trigger_kind,started_at,finished_at,result
    ) values(
      null,p_execution_id,'cloud-automation-summary',
      p_started_at,p_finished_at,p_result
    )
    returning result into final_result;
  else
    update public.collector_edge_events
       set started_at=least(started_at,p_started_at),
           finished_at=p_finished_at,
           result=p_result
     where id=event_id
     returning result into final_result;
  end if;

  return final_result;
end;
$$;

revoke all on function public.collector_finalize_daily_producer(
  text,timestamptz,timestamptz,date,date,jsonb
) from public,anon,authenticated,service_role;
grant execute on function public.collector_finalize_daily_producer(
  text,timestamptz,timestamptz,date,date,jsonb
) to service_role;
