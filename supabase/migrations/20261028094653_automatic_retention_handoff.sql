-- Even a direct keep/relevance decision cannot omit the writer handoff.
create function private.enqueue_retained_korean_draft() returns trigger
language plpgsql security invoker set search_path=public,pg_temp as $$
declare input_hash text;
begin
 if new.metadata->>'retention_decision'='keep' and new.metadata->>'retention_revision'=new.current_revision_id::text then return new;end if;
 select content_hash into strict input_hash from source_item_revisions where id=new.current_revision_id;
 perform collector_retain_for_draft(new.id,new.current_revision_id,input_hash,coalesce(nullif(new.metadata->>'retention_reason',''),'Privacy relevance verified; retained for Korean drafting'));
 return new;
end; $$;
revoke all on function private.enqueue_retained_korean_draft() from public,anon,authenticated;
create trigger enqueue_retained_korean_draft after update of relevance_status,current_revision_id on public.source_items
for each row when(new.relevance_status='relevant' and new.current_revision_id is not null)
execute function private.enqueue_retained_korean_draft();
