-- A Trafilatura metadata date is weaker than an explicit listing/body label.
-- It can fill a gap, but must not veto a labeled date (e.g. an event date
-- extracted from an IAPP article while the listing gives its posting date).
do $$
declare definition text; original text;
begin
  definition=pg_get_functiondef('private.collector_date_evidence(public.source_items,public.source_item_revisions)'::regprocedure);
  original=definition;
  definition=replace(definition,
    'if candidate is not null and selected is not null and selected<>candidate then return null; end if;'||E'\n    if candidate is not null and selected is null then selected=candidate; selected_method=''trafilatura_date_candidate''; end if;',
    'if candidate is not null and selected is null then selected=candidate; selected_method=''trafilatura_date_candidate''; end if;');
  if definition=original then raise exception 'Trafilatura candidate precedence changed; review required'; end if;
  execute definition;
end $$;

update public.source_items i
set published_at=case when private.collector_date_evidence(i,r) is null then null else ((private.collector_date_evidence(i,r)->>'date')::date)::timestamp at time zone 'UTC' end,
    metadata=case when private.collector_date_evidence(i,r) is null then i.metadata-'publication_date_resolution'
      else i.metadata||jsonb_build_object('publication_date_resolution',private.collector_date_evidence(i,r)) end,
    updated_at=now()
from public.source_item_revisions r
where r.id=i.current_revision_id and i.metadata ? 'publication_date_resolution';

update public.source_items i
set published_at=((private.collector_date_evidence(i,r)->>'date')::date)::timestamp at time zone 'UTC',
    metadata=i.metadata||jsonb_build_object('publication_date_resolution',private.collector_date_evidence(i,r)),updated_at=now()
from public.source_item_revisions r
where r.id=i.current_revision_id and i.published_at is null
  and not exists(select 1 from public.reports rp where rp.source_item_id=i.id)
  and private.collector_date_evidence(i,r) is not null;
