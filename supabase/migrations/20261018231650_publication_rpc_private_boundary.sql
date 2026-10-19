-- Public RPCs retain caller privileges; the private core checks active membership
-- and action-specific administrator rights before taking any row locks or writes.
grant execute on function private.apply_publication_workspace_action(text,text,uuid,bigint,jsonb) to authenticated;
alter function public.save_publication_draft(text,uuid,bigint,jsonb) security invoker;
alter function public.publish_publication_draft(text,uuid,bigint) security invoker;
alter function public.unpublish_publication(text,uuid,bigint) security invoker;
alter function public.trash_publication_draft(text,uuid,bigint) security invoker;
alter function public.restore_publication_draft(text,uuid,bigint) security invoker;
alter function public.request_publication_draft(text,uuid,bigint) security invoker;
