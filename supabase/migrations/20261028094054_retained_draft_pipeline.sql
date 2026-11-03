-- Retention is a durable promise to finish a Korean draft, not an editorial sample.
create function public.collector_retain_for_draft(p_item_id uuid,p_revision_id uuid,p_input_hash text,p_reason text)
returns jsonb language plpgsql security invoker set search_path=public,pg_temp as $$
declare i source_items; r source_item_revisions; j draft_jobs;
begin
 select * into strict i from source_items where id=p_item_id for update;
 select * into strict r from source_item_revisions where id=p_revision_id;
 if i.current_revision_id is distinct from r.id or r.source_item_id<>i.id or r.content_hash is distinct from p_input_hash then raise exception 'retention input revision mismatch' using errcode='22023'; end if;
 if nullif(trim(p_reason),'') is null or i.published_at is null or length(r.content_text) not between 10 and 80000 or r.metadata->>'ai_ready' is distinct from 'true' or not exists(select 1 from sources where id=i.source_id and is_active and terms_reviewed_at is not null) then raise exception 'source must be verified before retention' using errcode='22023'; end if;
 if exists(select 1 from reports where source_item_id=i.id) then return jsonb_build_object('status','existing_report_preserved','item_id',i.id);end if;
 insert into draft_jobs(source_item_id,source_item_revision_id,instruction_version,input_hash) values(i.id,r.id,'trend-ko-v1',r.content_hash)
 on conflict(source_item_id,instruction_version,input_hash) do update set source_item_revision_id=excluded.source_item_revision_id returning * into j;
 -- Do not reset attempts, leases, or terminal errors to make a stuck job look ready.
 update source_items set relevance_status='relevant',metadata=metadata||jsonb_build_object('retention_decision','keep','retention_revision',r.id,'retention_reason',p_reason,'retained_at',now()),updated_at=now() where id=i.id;
 return jsonb_build_object('status','draft_required','item_id',i.id,'job_id',j.id,'revision_id',r.id,'input_hash',r.content_hash,'job_status',j.status,'attempts',j.attempts);
end; $$;
create function public.collector_claim_retained_draft(p_worker text) returns jsonb
language plpgsql security invoker set search_path=public,pg_temp as $$
declare target uuid; payload jsonb;
begin
 select j.id into target from draft_jobs j join source_items i on i.id=j.source_item_id
 where i.metadata->>'retention_decision'='keep' and i.relevance_status='relevant' and j.source_item_revision_id=i.current_revision_id
 and not exists(select 1 from reports where source_item_id=i.id)
 and j.attempts<3 and (j.status in ('pending','failed') or j.status='claimed' and j.lease_until<now())
 order by j.created_at,j.id limit 1;
 if target is null then return jsonb_build_object('status','no_claimable_retained_job');end if;
 payload=claim_trend_draft_jobs(p_worker,1,target);
 return jsonb_build_object('status',case when jsonb_array_length(payload)=1 then 'claimed' else 'blocked_or_leased' end,'jobs',payload);
end; $$;
create function public.collector_retained_draft_status() returns jsonb
language sql stable security invoker set search_path=public,pg_temp as $$
 select jsonb_build_object('retained',count(*),'draft_stored',count(*) filter(where exists(select 1 from reports rp where rp.source_item_id=i.id and nullif(trim(rp.title_ko),'') is not null and nullif(trim(rp.one_line_summary_ko),'') is not null and nullif(trim(rp.detailed_summary_ko),'') is not null)),
 'unfinished',count(*) filter(where not exists(select 1 from reports rp where rp.source_item_id=i.id and nullif(trim(rp.title_ko),'') is not null and nullif(trim(rp.one_line_summary_ko),'') is not null and nullif(trim(rp.detailed_summary_ko),'') is not null)))
 from source_items i where i.metadata->>'retention_decision'='keep';
$$;
revoke all on function public.collector_retain_for_draft(uuid,uuid,text,text),public.collector_claim_retained_draft(text),public.collector_retained_draft_status() from public,anon,authenticated,service_role;
grant execute on function public.collector_retain_for_draft(uuid,uuid,text,text),public.collector_claim_retained_draft(text),public.collector_retained_draft_status() to service_role;

create function private.guard_producer_completion() returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
declare pending bigint;
begin
 if new.trigger_kind='cloud-automation-summary' and new.result->>'role'='daily-producer' then
  select count(*) into pending from source_items i where i.metadata->>'retention_decision'='keep'
  and not exists(select 1 from reports r where r.source_item_id=i.id and nullif(trim(r.title_ko),'') is not null and nullif(trim(r.one_line_summary_ko),'') is not null and nullif(trim(r.detailed_summary_ko),'') is not null);
  new.result=new.result||jsonb_build_object('retained_drafts_unfinished',pending);
  if pending>0 then new.result=new.result||jsonb_build_object('status','partial','completion_blocked','retained_korean_drafts_unfinished');end if;
 end if;
 return new;
end; $$;
revoke all on function private.guard_producer_completion() from public,anon,authenticated;
create trigger guard_retained_draft_completion before insert on public.collector_edge_events for each row execute function private.guard_producer_completion();
