-- Public discovery metadata is separate from reviewed Korean report publication.
create function public.get_trend_catalog(p_offset integer default 0,p_limit integer default 200,p_item_id uuid default null)
returns table(item_id uuid,report_id uuid,title text,original_title text,official_url text,source_name text,published_date date,document_type text,editorial_status text,jurisdictions text[],topics text[])
language sql stable security definer set search_path=public,pg_temp as $$
 select i.id,r.id,coalesce(r.title_ko,i.title_original),i.title_original,i.canonical_url,s.name,
 (i.published_at at time zone 'Asia/Seoul')::date,i.document_type,
 case when r.id is not null then 'published' when exists(select 1 from reports d where d.source_item_id=i.id and d.status in ('draft','in_review','approved')) then 'review_pending' else 'collected' end,
 coalesce(r.jurisdictions,'{}'::text[]),coalesce(r.topics,'{}'::text[])
 from source_items i join sources s on s.id=i.source_id
 left join lateral(select * from reports x where x.source_item_id=i.id and x.status='published' order by x.published_at desc,x.id limit 1) r on true
 where s.is_active and s.terms_reviewed_at is not null and (p_item_id is null or i.id=p_item_id)
 order by i.published_at desc nulls last,i.id
 limit least(greatest(p_limit,1),200) offset greatest(p_offset,0);
$$;
revoke all on function public.get_trend_catalog(integer,integer,uuid) from public;
grant execute on function public.get_trend_catalog(integer,integer,uuid) to anon,authenticated,service_role;

alter table public.weekly_issues add column selection_notes jsonb not null default '[]'::jsonb;
create function public.save_written_weekly_draft(p_issue_key text,p_title text,p_start date,p_end date,p_selection jsonb)
returns text language plpgsql security definer set search_path=public,pg_temp as $$
declare n integer; entry jsonb;
begin
 if current_setting('request.jwt.claim.role',true) is distinct from 'service_role' and not coalesce(private.is_team_member('admin'),false) then raise exception 'admin or producer required' using errcode='42501'; end if;
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
revoke all on function public.save_written_weekly_draft(text,text,date,date,jsonb) from public;
grant execute on function public.save_written_weekly_draft(text,text,date,date,jsonb) to authenticated,service_role;
create function public.publish_written_weekly_issue(p_issue_key text) returns void language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if not coalesce(private.is_team_member('admin'),false) then raise exception 'admin required' using errcode='42501'; end if;
 perform 1 from weekly_issues where issue_key=p_issue_key and status='draft' for update;
 if not found then raise exception 'draft issue required'; end if;
 if not exists(select 1 from weekly_issue_reports where issue_key=p_issue_key) or exists(select 1 from weekly_issue_reports w join reports r on r.id=w.report_id where w.issue_key=p_issue_key and (r.status<>'published' or not r.human_reviewed)) then raise exception 'all selected reports must be reviewed and published'; end if;
 update weekly_issues set status='published',published_at=now() where issue_key=p_issue_key;
end; $$;
revoke all on function public.publish_written_weekly_issue(text) from public;
grant execute on function public.publish_written_weekly_issue(text) to authenticated;
