-- Keep published issues editable: saving changes the live issue contents in
-- one transaction while preserving its published state and publication date.
create or replace function public.save_written_weekly_edition(p_issue_key text,p_title text,p_start date,p_end date,p_selection jsonb)
returns text language plpgsql security invoker set search_path=public,pg_temp as $$
declare n integer; entry jsonb; current_status text;
begin
 if current_user not in ('postgres','service_role') and not coalesce(private.is_team_member('admin'),false) then raise exception 'admin required' using errcode='42501'; end if;
 if p_issue_key !~ '^[0-9]{4}-W(0[1-9]|[1-4][0-9]|5[0-3])$' or nullif(trim(p_title),'') is null or length(p_title)>160 or p_start is null or p_end is null or p_end<>p_start+6 or extract(isodow from p_start)<>1 or p_issue_key<>to_char(p_start,'IYYY-"W"IW') or jsonb_typeof(p_selection) is distinct from 'array' then raise exception 'invalid weekly issue'; end if;
 n=jsonb_array_length(p_selection);
 if n<1 or n>8 or (select count(distinct value->>'report_id') from jsonb_array_elements(p_selection))<>n then raise exception 'invalid or duplicate selection'; end if;
 insert into written_weekly_issues(issue_key,title,week_start,week_end,status,published_at,selection_notes)
 values(p_issue_key,p_title,p_start,p_end,'draft',null,p_selection) on conflict(issue_key) do nothing;
 select status into current_status from written_weekly_issues where issue_key=p_issue_key for update;
 if current_status not in ('draft','published') then raise exception 'weekly issue cannot be edited'; end if;
 for entry in select value from jsonb_array_elements(p_selection) loop
  if nullif(trim(entry->>'reason'),'') is null or not exists(
   select 1 from reports r join source_items i on i.id=r.source_item_id
   where r.id=(entry->>'report_id')::uuid
    and r.status in ('draft','in_review','approved','published')
    and (current_status<>'published' or r.status='published')
    and (i.published_at at time zone 'Asia/Seoul')::date between p_start and p_end
  ) then raise exception 'report unavailable or outside week'; end if;
 end loop;
 if (select count(distinct r.source_item_id) from reports r where r.id in(select (value->>'report_id')::uuid from jsonb_array_elements(p_selection)))<>n then raise exception 'duplicate source item'; end if;
 update written_weekly_issues set title=p_title,week_start=p_start,week_end=p_end,selection_notes=p_selection where issue_key=p_issue_key;
 delete from written_weekly_issue_reports where issue_key=p_issue_key;
 insert into written_weekly_issue_reports(issue_key,report_id,sort_order) select p_issue_key,(value->>'report_id')::uuid,ordinality-1 from jsonb_array_elements(p_selection) with ordinality;
 return p_issue_key;
end; $$;

revoke all on function public.save_written_weekly_edition(text,text,date,date,jsonb) from public,anon,authenticated,service_role;
grant execute on function public.save_written_weekly_edition(text,text,date,date,jsonb) to authenticated,service_role;
