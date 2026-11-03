revoke all on function public.save_written_weekly_draft(text,text,date,date,jsonb) from public,anon,authenticated,service_role;
grant execute on function public.save_written_weekly_draft(text,text,date,date,jsonb) to authenticated,service_role;
revoke all on function public.publish_written_weekly_issue(text) from public,anon,authenticated,service_role;
grant execute on function public.publish_written_weekly_issue(text) to authenticated;
