-- A written weekly edition only contains reports that are currently public.
-- Publication state is the editorial gate; do not require the legacy
-- human_reviewed flag, which is not consistently set for already published
-- reports and can block an otherwise valid weekly issue.
create or replace function public.publish_written_weekly_edition(p_issue_key text)
returns void language plpgsql security invoker set search_path=public,pg_temp as $$
begin
 if not coalesce(private.is_team_member('admin'),false) then raise exception 'admin required' using errcode='42501'; end if;
 perform 1 from written_weekly_issues where issue_key=p_issue_key and status='draft' for update;
 if not found then raise exception 'draft issue required'; end if;
 if not exists(select 1 from written_weekly_issue_reports where issue_key=p_issue_key)
    or exists(select 1 from written_weekly_issue_reports w join reports r on r.id=w.report_id where w.issue_key=p_issue_key and r.status<>'published') then
   raise exception 'all selected reports must be published';
 end if;
 update written_weekly_issues set status='published',published_at=now() where issue_key=p_issue_key;
end; $$;

revoke all on function public.publish_written_weekly_edition(text) from public,anon,authenticated,service_role;
grant execute on function public.publish_written_weekly_edition(text) to authenticated;
