-- A logged-in visitor is not necessarily a team member. Keep audit identities
-- and metadata behind server-side functions for authenticated visitors too.
revoke select on public.law_versions,public.reports,public.source_items from authenticated;
grant select(id,legal_instrument_id,version_label,valid_from,valid_to,effective_date,
 source_checked_at,source_url,status,created_at,review_payload,content_hash) on public.law_versions to authenticated;
grant select(id,source_item_id,title_ko,one_line_summary_ko,detailed_summary_ko,key_points,
 policy_implications_ko,jurisdictions,topics,status,published_at,created_at,updated_at) on public.reports to authenticated;
grant select(id,source_id,external_id,canonical_url,title_original,published_at,event_date,
 discovered_at,fetched_at,language_code,document_type,content_text,content_hash,
 raw_storage_path,pipeline_status,relevance_status,created_at,updated_at) on public.source_items to authenticated;

create or replace function private.guard_report_publication() returns trigger
language plpgsql security definer set search_path=pg_catalog,public,private as $$
begin
 if new.status in ('approved','published') and
    (tg_op='INSERT' or old.status is distinct from new.status) and
    not private.is_team_member('admin') then
   raise insufficient_privilege using message='Administrator approval is required';
 end if;
 if new.status='approved' and (tg_op='INSERT' or old.status<>'approved') then
   new.human_reviewed:=true; new.reviewed_by:=auth.uid(); new.reviewed_at:=now();
 end if;
 if new.status='published' and (tg_op='INSERT' or old.status<>'published') then
   if tg_op='INSERT' or old.status<>'approved' or not old.human_reviewed then
     raise invalid_parameter_value using message='Approve the report before publication';
   end if;
   new.published_at:=now();
 end if;
 if tg_op='INSERT' and new.status<>'published' then new.published_at:=null; end if;
 if tg_op='UPDATE' then
   if old.status='published' and new.status<>'published' then new.published_at:=null;
   elsif old.status=new.status then new.published_at:=old.published_at; end if;
 end if;
 if not private.is_team_member('admin') then
   if tg_op='INSERT' then new.human_reviewed:=false; new.reviewed_by:=null; new.reviewed_at:=null;
   else new.human_reviewed:=old.human_reviewed; new.reviewed_by:=old.reviewed_by; new.reviewed_at:=old.reviewed_at; end if;
 end if;
 new.updated_at:=now(); return new;
end; $$;
revoke all on function private.guard_report_publication() from public,anon,authenticated;

-- Authorization belongs to review_events, whose RLS exposes it only to the team.
update public.source_items set metadata=metadata-'publication_authorization'-'review_scope'
 where metadata ? 'publication_authorization';
update public.reports set automation_metadata=automation_metadata-'authorization_note'-'review_scope'
 where automation_metadata ? 'authorization_note';
