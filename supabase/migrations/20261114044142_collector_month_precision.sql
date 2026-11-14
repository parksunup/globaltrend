-- A publication month is useful in search, but must not be fabricated into a
-- day for weekly inclusion.
do $$
declare definition text; original text;
begin
  definition=pg_get_functiondef('private.collector_date_evidence(public.source_items,public.source_item_revisions)'::regprocedure);
  original=definition;
  definition=replace(definition,
    'month_number integer; year_number integer; inferred boolean=false;',
    'month_number integer; year_number integer; month_candidate text; inferred boolean=false;');
  definition=replace(definition,
    'candidate=null; inferred=false;',
    E'if value ~ ''^[0-9]{4}-[0-9]{2}$'' and substring(value,6,2)::integer between 1 and 12 then\n      if month_candidate is not null and month_candidate<>value then return null; end if;\n      month_candidate=value; continue;\n    end if;\n    candidate=null; inferred=false;');
  definition=replace(definition,
    'if selected is null then return null; end if;',
    E'if selected is not null and month_candidate is not null and to_char(selected,''YYYY-MM'')<>month_candidate then return null; end if;\n  if selected is null and month_candidate is not null then\n    return jsonb_build_object(''month'',month_candidate,''precision'',''month'',''year_inferred'',false,''method'',''date_observation_month'');\n  end if;\n  if selected is null then return null; end if;');
  if definition=original or position('month_candidate text' in definition)=0 then raise exception 'date month definition changed; review required'; end if;
  execute definition;
end $$;

update public.source_items i
set metadata=i.metadata||jsonb_build_object('publication_date_resolution',private.collector_date_evidence(i,r)),updated_at=now()
from public.source_item_revisions r
where r.id=i.current_revision_id and i.published_at is null
  and private.collector_date_evidence(i,r)->>'precision'='month';

-- Expose only the month label, never the private source metadata.
alter table public.source_items add column publication_month text
  check (publication_month is null or publication_month ~ '^[0-9]{4}-[0-9]{2}$');
update public.source_items
set publication_month=metadata#>>'{publication_date_resolution,month}'
where metadata#>>'{publication_date_resolution,precision}'='month';
grant select(publication_month) on public.source_items to anon,authenticated;

create function private.set_collector_publication_month() returns trigger
language plpgsql security definer set search_path=pg_catalog,public,pg_temp as $$
begin
  new.publication_month=case when new.metadata#>>'{publication_date_resolution,precision}'='month'
    then new.metadata#>>'{publication_date_resolution,month}' else null end;
  return new;
end $$;
create trigger set_collector_publication_month
before insert or update of metadata on public.source_items for each row
execute function private.set_collector_publication_month();
revoke all on function private.set_collector_publication_month() from public,anon,authenticated;
