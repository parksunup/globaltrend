-- Create a review-only weekly edition from existing Korean reports.
-- This never claims source items, writes report drafts, approves, or publishes.

create or replace function public.weekly_digest_candidates(p_start date, p_end date)
returns table(
  id uuid,
  title text,
  summary text,
  details text,
  date text,
  topics text[],
  jurisdictions text[]
)
language sql
security invoker
set search_path = public, pg_temp
as $$
  with current_reports as (
    select distinct on (r.source_item_id)
      r.id,
      r.source_item_id,
      r.title_ko,
      r.one_line_summary_ko,
      r.detailed_summary_ko,
      r.topics,
      r.jurisdictions,
      i.published_at
    from public.reports r
    join public.source_items i on i.id = r.source_item_id
    where r.status in ('draft', 'in_review', 'approved', 'published')
      and i.published_at is not null
      and (i.published_at at time zone 'Asia/Seoul')::date between p_start and p_end
    order by r.source_item_id, r.updated_at desc, r.created_at desc, r.id
  )
  select
    c.id,
    c.title_ko,
    c.one_line_summary_ko,
    c.detailed_summary_ko,
    (c.published_at at time zone 'Asia/Seoul')::date::text,
    coalesce(c.topics, '{}'),
    coalesce(c.jurisdictions, '{}')
  from current_reports c
  order by c.published_at desc, c.id;
$$;
revoke all on function public.weekly_digest_candidates(date, date) from public, anon, authenticated;
grant execute on function public.weekly_digest_candidates(date, date) to service_role;

-- Manual saves and the scheduled creator share the same per-week lock.
create or replace function public.save_written_weekly_edition(p_issue_key text,p_title text,p_start date,p_end date,p_selection jsonb)
returns text language plpgsql security invoker set search_path=public,pg_temp as $$
declare n integer; entry jsonb; current_status text;
begin
 if current_user not in ('postgres','service_role') and not coalesce(private.is_team_member('admin'),false) then raise exception 'admin required' using errcode='42501'; end if;
 if p_issue_key is distinct from public.monthly_week_issue_key(p_start) or nullif(trim(p_title),'') is null or length(p_title)>160 or p_start is null or p_end is null or p_end<>p_start+6 or extract(isodow from p_start)<>1 or jsonb_typeof(p_selection) is distinct from 'array' then raise exception 'invalid weekly issue'; end if;
 perform pg_advisory_xact_lock(hashtext('weekly-digest:' || p_start::text));
 n=jsonb_array_length(p_selection);
 if n<1 or n>8 or (select count(distinct value->>'report_id') from jsonb_array_elements(p_selection))<>n then raise exception 'invalid or duplicate selection'; end if;
 insert into written_weekly_issues(issue_key,title,week_start,week_end,status,published_at,selection_notes)
 values(p_issue_key,p_title,p_start,p_end,'draft',null,p_selection) on conflict(issue_key) do nothing;
 select status into current_status from written_weekly_issues where issue_key=p_issue_key for update;
 if current_status not in ('draft','published') then raise exception 'weekly issue cannot be edited'; end if;
 for entry in select value from jsonb_array_elements(p_selection) loop
  if nullif(trim(entry->>'reason'),'') is null or not exists(select 1 from reports r join source_items i on i.id=r.source_item_id where r.id=(entry->>'report_id')::uuid and r.status in ('draft','in_review','approved','published') and (current_status<>'published' or r.status='published') and (i.published_at at time zone 'Asia/Seoul')::date between p_start and p_end) then raise exception 'report unavailable or outside week'; end if;
 end loop;
 if (select count(distinct r.source_item_id) from reports r where r.id in(select (value->>'report_id')::uuid from jsonb_array_elements(p_selection)))<>n then raise exception 'duplicate source item'; end if;
 update written_weekly_issues set title=p_title,week_start=p_start,week_end=p_end,selection_notes=p_selection where issue_key=p_issue_key;
 delete from written_weekly_issue_reports where issue_key=p_issue_key;
 insert into written_weekly_issue_reports(issue_key,report_id,sort_order) select p_issue_key,(value->>'report_id')::uuid,ordinality-1 from jsonb_array_elements(p_selection) with ordinality;
 return p_issue_key;
end; $$;
revoke all on function public.save_written_weekly_edition(text,text,date,date,jsonb) from public, anon, authenticated, service_role;
grant execute on function public.save_written_weekly_edition(text,text,date,date,jsonb) to authenticated, service_role;

create or replace function public.create_weekly_digest_draft_if_missing(p_start date, p_end date, p_selection jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_key text;
  v_status text;
begin
  if current_user not in ('postgres', 'service_role') then
    raise exception 'service_role_required' using errcode = '42501';
  end if;
  if p_start is null or p_end is distinct from p_start + 6 or extract(isodow from p_start) <> 1 then
    raise exception 'invalid_week_period' using errcode = '22023';
  end if;
  v_key := public.monthly_week_issue_key(p_start);
  perform pg_advisory_xact_lock(hashtext('weekly-digest:' || p_start::text));

  select status into v_status
  from public.written_weekly_issues
  where issue_key = v_key
  for update;
  if found then
    return jsonb_build_object('status', 'existing_issue_preserved', 'issue_key', v_key, 'issue_status', v_status);
  end if;

  perform public.save_written_weekly_edition(
    v_key,
    '개인정보 주간동향',
    p_start,
    p_end,
    p_selection
  );
  return jsonb_build_object('status', 'created', 'issue_key', v_key, 'issue_status', 'draft');
end;
$$;
revoke all on function public.create_weekly_digest_draft_if_missing(date, date, jsonb) from public, anon, authenticated;
grant execute on function public.create_weekly_digest_draft_if_missing(date, date, jsonb) to service_role;

create or replace function private.weekly_digest_dispatch()
returns bigint
language plpgsql
security definer
set search_path = pg_catalog, private, net, vault, pg_temp
as $$
declare
  v_key text;
  v_request_id bigint;
begin
  select decrypted_secret into v_key
  from vault.decrypted_secrets
  where name = 'trend_collector_invocation_key';
  if v_key is null or length(v_key) < 20 then
    raise exception 'weekly_digest_invocation_secret_missing';
  end if;
  select net.http_post(
    url := 'https://emlgwhkgaihhrirhdpnp.supabase.co/functions/v1/weekly-digest',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-collector-key', v_key),
    body := '{"trigger":"weekly-cron"}'::jsonb,
    timeout_milliseconds := 30000
  ) into v_request_id;
  return v_request_id;
end;
$$;
revoke all on function private.weekly_digest_dispatch() from public, anon, authenticated, service_role;

-- Monday 09:00 Asia/Seoul = Monday 00:00 UTC. Supabase Cron runs in UTC.
select cron.unschedule(jobid)
from cron.job
where jobname = 'weekly-digest-monday-0900';

select cron.schedule(
  'weekly-digest-monday-0900',
  '0 0 * * 1',
  'select private.weekly_digest_dispatch();'
);
