begin;
-- Canonical weekly identifiers derive from the Monday date: YYYY-MM-Wn.
-- Podcast identifiers append an edition number: YYYY-MM-Wn-N.
create or replace function public.monthly_week_issue_key(p_week_start date)
returns text language plpgsql immutable strict set search_path=public,pg_temp as $$
begin
  if extract(isodow from p_week_start) <> 1 then raise exception 'week start must be Monday'; end if;
  return to_char(p_week_start,'YYYY-MM')||'-W'||ceil(extract(day from p_week_start)/7.0)::integer::text;
end; $$;

create or replace function public.canonical_week_monday(p_date date)
returns date language sql immutable strict as $$
  select p_date-((extract(isodow from p_date)::integer-1));
$$;

-- Map every legacy key from its stored Monday date, not from the old ISO week
-- string. Keep published podcast rows' edition 1 and preserve storage paths.
create temporary table _weekly_issue_key_map(old_key text primary key,new_key text not null,week_start date not null) on commit drop;
insert into _weekly_issue_key_map
select issue_key,public.monthly_week_issue_key(public.canonical_week_monday(week_start))||'-'||row_number() over(partition by public.canonical_week_monday(week_start) order by created_at,issue_key),public.canonical_week_monday(week_start)
from public.weekly_issues;

create temporary table _written_issue_key_map(old_key text primary key,new_key text not null,week_start date not null) on commit drop;
insert into _written_issue_key_map
select issue_key,public.monthly_week_issue_key(public.canonical_week_monday(week_start))||case when count(*) over(partition by public.canonical_week_monday(week_start))>1 and row_number() over(partition by public.canonical_week_monday(week_start) order by created_at,issue_key)>1 then '-'||row_number() over(partition by public.canonical_week_monday(week_start) order by created_at,issue_key) else '' end,public.canonical_week_monday(week_start)
from public.written_weekly_issues;

create temporary table _podcast_job_key_map(job_id uuid primary key,new_key text not null,week_start date not null) on commit drop;
insert into _podcast_job_key_map
select j.id,coalesce(w.new_key,
       public.monthly_week_issue_key(public.canonical_week_monday((j.packet->>'weekStart')::date))||'-'||
       (coalesce((select max(split_part(m.new_key,'-',4)::integer) from _weekly_issue_key_map m where m.week_start=public.canonical_week_monday((j.packet->>'weekStart')::date)),0)
        +row_number() over(partition by public.canonical_week_monday((j.packet->>'weekStart')::date) order by j.created_at,j.id))),
       coalesce(w.week_start,public.canonical_week_monday((j.packet->>'weekStart')::date))
from public.podcast_production_jobs j
left join _weekly_issue_key_map w on w.old_key=j.issue_key;

alter table public.weekly_issue_reports drop constraint weekly_issue_reports_issue_key_fkey;
alter table public.weekly_podcast_episodes drop constraint weekly_podcast_episodes_issue_key_fkey;
alter table public.written_weekly_issue_reports drop constraint written_weekly_issue_reports_issue_key_fkey;

alter table public.weekly_issues drop constraint weekly_issues_issue_key_check;
alter table public.written_weekly_issues drop constraint written_weekly_issues_issue_key_check;
alter table public.podcast_production_jobs drop constraint podcast_production_jobs_issue_key_check;
alter table public.podcast_production_jobs drop constraint podcast_production_jobs_phase_check;

update public.weekly_issue_reports r set issue_key=m.new_key from _weekly_issue_key_map m where r.issue_key=m.old_key;
update public.weekly_podcast_episodes e set issue_key=m.new_key from _weekly_issue_key_map m where e.issue_key=m.old_key;
update public.weekly_issues i set issue_key=m.new_key,week_start=m.week_start,week_end=m.week_start+6 from _weekly_issue_key_map m where i.issue_key=m.old_key;
update public.written_weekly_issue_reports r set issue_key=m.new_key from _written_issue_key_map m where r.issue_key=m.old_key;
update public.written_weekly_issues i set issue_key=m.new_key,week_start=m.week_start,week_end=m.week_start+6 from _written_issue_key_map m where i.issue_key=m.old_key;
update public.podcast_production_jobs j set issue_key=m.new_key,
  packet=case when j.issue_key='2099-W01' then jsonb_set(
    jsonb_set(jsonb_set(jsonb_set(j.packet,'{issueKey}',to_jsonb(m.new_key),true),'{weekStart}',to_jsonb(m.week_start::text),true),'{weekEnd}',to_jsonb((m.week_start+6)::text),true),
    '{testFixture}', 'true'::jsonb, true
  ) else jsonb_set(jsonb_set(jsonb_set(j.packet,'{issueKey}',to_jsonb(m.new_key),true),'{weekStart}',to_jsonb(m.week_start::text),true),'{weekEnd}',to_jsonb((m.week_start+6)::text),true) end
from _podcast_job_key_map m where j.id=m.job_id;

alter table public.weekly_issues add constraint weekly_issues_issue_key_check
  check(issue_key ~ '^[0-9]{4}-(0[1-9]|1[0-2])-W[1-5]-[1-9][0-9]*$');
alter table public.written_weekly_issues add constraint written_weekly_issues_issue_key_check
  check(issue_key ~ '^[0-9]{4}-(0[1-9]|1[0-2])-W[1-5](-[1-9][0-9]*)?$');
alter table public.podcast_production_jobs add constraint podcast_production_jobs_issue_key_check
  check(issue_key ~ '^[0-9]{4}-(0[1-9]|1[0-2])-W[1-5]-[1-9][0-9]*$');
alter table public.podcast_production_jobs add constraint podcast_production_jobs_phase_check
  check(phase in ('queued','opening','adding_sources','generating','collecting','uploading','ready','published','unpublished','needs_login','blocked','failed','cancelled'));

alter table public.weekly_issue_reports add constraint weekly_issue_reports_issue_key_fkey
  foreign key(issue_key) references public.weekly_issues(issue_key) on delete cascade;
alter table public.weekly_podcast_episodes add constraint weekly_podcast_episodes_issue_key_fkey
  foreign key(issue_key) references public.weekly_issues(issue_key) on delete restrict;
alter table public.written_weekly_issue_reports add constraint written_weekly_issue_reports_issue_key_fkey
  foreign key(issue_key) references public.written_weekly_issues(issue_key) on delete cascade;

create table public.weekly_podcast_issue_reservations(
  week_start date primary key check(extract(isodow from week_start)=1),
  last_edition integer not null check(last_edition>0),
  updated_at timestamptz not null default now()
);
alter table public.weekly_podcast_issue_reservations enable row level security;
revoke all on public.weekly_podcast_issue_reservations from public,anon,authenticated;

create or replace function public.reserve_weekly_podcast_issue_key(p_week_start date)
returns text language plpgsql security definer set search_path=public,private,pg_temp as $$
declare v_base text; v_existing integer; v_next integer;
begin
  if auth.uid() is null or not private.is_team_member('admin') then raise exception 'admin role required' using errcode='42501'; end if;
  if p_week_start is null or extract(isodow from p_week_start)<>1 then raise exception 'week start must be Monday' using errcode='22023'; end if;
  v_base:=public.monthly_week_issue_key(p_week_start);
  perform pg_advisory_xact_lock(hashtext('podcast-edition:'||p_week_start::text));
  select greatest(
    coalesce((select max(split_part(issue_key,'-',4)::integer) from public.weekly_issues where week_start=p_week_start),0),
    coalesce((select max(split_part(issue_key,'-',4)::integer) from public.podcast_production_jobs where (packet->>'weekStart')::date=p_week_start),0),
    coalesce((select last_edition from public.weekly_podcast_issue_reservations where week_start=p_week_start),0)
  )+1 into v_next;
  insert into public.weekly_podcast_issue_reservations(week_start,last_edition)
  values(p_week_start,v_next)
  on conflict(week_start) do update set last_edition=excluded.last_edition,updated_at=now();
  return v_base||'-'||v_next::text;
end; $$;

revoke all on function public.reserve_weekly_podcast_issue_key(date) from public,anon;
grant execute on function public.reserve_weekly_podcast_issue_key(date) to authenticated;

create or replace function public.unpublish_weekly_podcast_issue(p_issue_key text)
returns void language plpgsql security definer set search_path=public,private,pg_temp as $$
declare v_status text;
begin
  if auth.uid() is null or not private.is_team_member('admin') then raise exception 'admin role required' using errcode='42501'; end if;
  select status into v_status from public.weekly_podcast_episodes where issue_key=p_issue_key for update;
  if not found then raise exception 'podcast issue not found' using errcode='P0002'; end if;
  if v_status='published' then update public.weekly_podcast_episodes set status='withdrawn' where issue_key=p_issue_key;
  elsif v_status<>'withdrawn' then raise exception 'podcast issue is not published' using errcode='22023'; end if;
  update public.podcast_production_jobs set phase='unpublished',updated_at=now(),message='' where issue_key=p_issue_key and phase='published';
end; $$;
revoke all on function public.unpublish_weekly_podcast_issue(text) from public,anon;
grant execute on function public.unpublish_weekly_podcast_issue(text) to authenticated;

create or replace function public.unpublish_podcast_production_job(p_job_id uuid)
returns void language plpgsql security definer set search_path=public,private,pg_temp as $$
declare j public.podcast_production_jobs;
begin
  if auth.uid() is null or not private.is_team_member('admin') then raise exception 'admin role required' using errcode='42501'; end if;
  select * into strict j from public.podcast_production_jobs where id=p_job_id;
  if j.phase='unpublished' then return; end if;
  if j.phase<>'published' then raise exception 'podcast is not published' using errcode='22023'; end if;
  perform public.unpublish_weekly_podcast_issue(j.issue_key);
end; $$;
revoke all on function public.unpublish_podcast_production_job(uuid) from public,anon;
grant execute on function public.unpublish_podcast_production_job(uuid) to authenticated;

create or replace function public.save_written_weekly_edition(p_issue_key text,p_title text,p_start date,p_end date,p_selection jsonb)
returns text language plpgsql security invoker set search_path=public,pg_temp as $$
declare n integer; entry jsonb; current_status text;
begin
 if current_user not in ('postgres','service_role') and not coalesce(private.is_team_member('admin'),false) then raise exception 'admin required' using errcode='42501'; end if;
 if p_issue_key is distinct from public.monthly_week_issue_key(p_start) or nullif(trim(p_title),'') is null or length(p_title)>160 or p_start is null or p_end is null or p_end<>p_start+6 or extract(isodow from p_start)<>1 or jsonb_typeof(p_selection) is distinct from 'array' then raise exception 'invalid weekly issue'; end if;
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

create or replace function public.publish_weekly_podcast_issue(p_issue_key text,p_title text,p_description text,p_week_start date,p_week_end date,p_report_ids uuid[],p_audio_path text,p_audio_mime_type text,p_file_size_bytes bigint)
returns void language plpgsql set search_path=public,pg_temp as $$
declare v_report_count bigint; v_extension text;
begin
 if auth.uid() is null or not private.is_team_member('admin') then raise exception 'admin role required' using errcode='42501'; end if;
 if p_issue_key !~ '^[0-9]{4}-[0-9]{2}-W[1-5]-[1-9][0-9]*$' or p_issue_key !~ ('^'||public.monthly_week_issue_key(p_week_start)||'-[1-9][0-9]*$') or nullif(btrim(p_title),'') is null or char_length(p_title)>160 or char_length(coalesce(p_description,''))>1000 or p_week_start is null or p_week_end<>p_week_start+6 or extract(isodow from p_week_start)<>1 or coalesce(cardinality(p_report_ids),0) not between 1 and 20 or p_file_size_bytes not between 1 and 52428800 or p_audio_mime_type not in ('audio/mpeg','audio/wav','audio/mp4','audio/x-m4a') then raise exception 'invalid weekly issue or podcast data' using errcode='22023'; end if;
 if (select count(distinct report_id) from unnest(p_report_ids) as ids(report_id))<>cardinality(p_report_ids) then raise exception 'duplicate report IDs are not allowed' using errcode='22023'; end if;
 select count(*) into v_report_count from public.reports r where r.id=any(p_report_ids) and r.status='published';
 if v_report_count<>cardinality(p_report_ids) then raise exception 'all included reports must already be published' using errcode='22023'; end if;
 v_extension:=case when p_audio_mime_type='audio/mpeg' then 'mp3' when p_audio_mime_type='audio/wav' then 'wav' else 'm4a' end;
 if p_audio_path !~ ('^'||p_issue_key||'/[0-9a-f-]{36}\.'||v_extension||'$') then raise exception 'invalid audio path' using errcode='22023'; end if;
 insert into public.weekly_issues(issue_key,title,description,week_start,week_end,status,created_by,published_at) values(p_issue_key,btrim(p_title),coalesce(p_description,''),p_week_start,p_week_end,'published',auth.uid(),now());
 insert into public.weekly_issue_reports(issue_key,report_id,sort_order) select p_issue_key,ids.report_id,(ids.ordinality-1)::integer from unnest(p_report_ids) with ordinality as ids(report_id,ordinality);
 insert into public.weekly_podcast_episodes(issue_key,audio_path,audio_mime_type,file_size_bytes,status,created_by,published_at) values(p_issue_key,p_audio_path,p_audio_mime_type,p_file_size_bytes,'published',auth.uid(),now());
end; $$;
notify pgrst,'reload schema';
commit;
