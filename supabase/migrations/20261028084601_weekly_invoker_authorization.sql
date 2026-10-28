create or replace function public.save_written_weekly_draft(p_issue_key text,p_title text,p_start date,p_end date,p_selection jsonb)
returns text language plpgsql security invoker set search_path=public,pg_temp as $$
declare n integer; entry jsonb;
begin
 if current_user not in ('postgres','service_role') and not coalesce(private.is_team_member('admin'),false) then raise exception 'admin or producer required' using errcode='42501'; end if;
 if p_issue_key !~ '^[0-9]{4}-W(0[1-9]|[1-4][0-9]|5[0-3])$' or nullif(trim(p_title),'') is null or length(p_title)>160 or p_start is null or p_end is null or p_end<>p_start+6 or extract(isodow from p_start)<>1 or p_issue_key<>to_char(p_start,'IYYY-"W"IW') or jsonb_typeof(p_selection) is distinct from 'array' then raise exception 'invalid weekly issue'; end if;
 n=jsonb_array_length(p_selection);
 if n<1 or n>20 or (select count(distinct value->>'report_id') from jsonb_array_elements(p_selection))<>n then raise exception 'invalid or duplicate selection'; end if;
 for entry in select value from jsonb_array_elements(p_selection) loop
  if nullif(trim(entry->>'reason'),'') is null or not exists(select 1 from reports r join source_items i on i.id=r.source_item_id where r.id=(entry->>'report_id')::uuid and r.status in ('draft','in_review','approved','published') and (i.published_at at time zone 'Asia/Seoul')::date between p_start and p_end) then raise exception 'report unavailable or outside week'; end if;
 end loop;
 if (select count(distinct r.source_item_id) from reports r where r.id in(select (value->>'report_id')::uuid from jsonb_array_elements(p_selection)))<>n then raise exception 'duplicate source item'; end if;
 insert into weekly_issues(issue_key,title,week_start,week_end,status,published_at,selection_notes) values(p_issue_key,p_title,p_start,p_end,'draft',null,p_selection)
 on conflict(issue_key) do nothing;
 perform 1 from weekly_issues where issue_key=p_issue_key for update;
 if exists(select 1 from weekly_issues where issue_key=p_issue_key and status<>'draft') then raise exception 'published issue cannot be replaced'; end if;
 update weekly_issues set title=p_title,week_start=p_start,week_end=p_end,selection_notes=p_selection where issue_key=p_issue_key;
 delete from weekly_issue_reports where issue_key=p_issue_key;
 insert into weekly_issue_reports(issue_key,report_id,sort_order) select p_issue_key,(value->>'report_id')::uuid,ordinality-1 from jsonb_array_elements(p_selection) with ordinality;
 return p_issue_key;
end; $$;

alter function public.publish_written_weekly_issue(text) security invoker;
