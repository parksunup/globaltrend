-- Run after the new migration, inside an explicit BEGIN ... ROLLBACK.
do $$
declare claim jsonb; second jsonb; output jsonb; bundle jsonb; original_edge jsonb; sid uuid;
begin
 select source_id,state into sid,original_edge from public.collector_edge_sources where slug='ftc';
 if has_function_privilege('anon','public.collector_cloud_take(text,text)','execute') then raise exception 'anonymous claim allowed'; end if;
 if has_function_privilege('authenticated','public.collector_cloud_commit(uuid,text,uuid,jsonb,text)','execute') then raise exception 'browser commit allowed'; end if;
 -- Test data and visibility changes are all rolled back by the caller.
 update pgmq.q_trend_collect set vt=now()-interval '1 second' where (message->>'source_id')::uuid=sid;
 perform public.collector_cloud_route('ftc',true);
 perform pgmq.send('trend_collect',jsonb_build_object('source_id',sid,'kind','rollback-validation'));
 claim=public.collector_cloud_take('rollback-worker','ftc');
 if claim is null then raise exception 'expected a claim'; end if;
 second=public.collector_cloud_take('other-worker','ftc');
 if second is not null then raise exception 'duplicate concurrent source claim'; end if;
 begin
  perform public.collector_cloud_route('ftc',false);
  raise exception 'route changed during active lease';
 exception when others then if sqlerrm='route changed during active lease' then raise; end if; end;
 second=public.collector_edge_take();
 if second->>'slug'='ftc' then raise exception 'Edge consumed cloud source'; end if;
 bundle=jsonb_build_object('cursor',jsonb_build_object('page','https://www.ftc.gov/feeds/press-release-consumer-protection.xml','offset',7),
  'operations','[]'::jsonb,'result',jsonb_build_object('since',claim->>'since','until',claim->>'until',
  'status','failed','reason','http_503','started_at',now(),'coverage_complete',true));
 begin
  perform public.collector_cloud_commit(sid,'wrong-worker',(claim->>'lease_token')::uuid,bundle,'rollback-test');
  raise exception 'wrong worker accepted';
 exception when others then if sqlerrm='wrong worker accepted' then raise; end if; end;
 begin
  perform public.collector_cloud_commit(sid,'rollback-worker',(claim->>'lease_token')::uuid,jsonb_set(bundle,'{cursor}','42'::jsonb),'bad-cursor-test');
  raise exception 'malformed cursor accepted';
 exception when others then if sqlerrm='malformed cursor accepted' then raise; end if; end;
 output=public.collector_cloud_commit(sid,'rollback-worker',(claim->>'lease_token')::uuid,bundle,'rollback-test');
 if output->>'retry_after_seconds'<>'3600' or output->>'coverage_complete'<>'false' then raise exception 'failure coverage/retry incorrect'; end if;
 if (select cursor->>'offset' from public.collector_cloud_routes where source_id=sid)<>'7' then raise exception 'cursor not saved'; end if;
 if (select state from public.collector_edge_sources where source_id=sid) is distinct from original_edge then raise exception 'Edge state overwritten'; end if;
 begin
  perform public.collector_cloud_commit(sid,'rollback-worker',(claim->>'lease_token')::uuid,bundle,'rollback-test-duplicate');
  raise exception 'duplicate commit accepted';
 exception when others then if sqlerrm='duplicate commit accepted' then raise; end if; end;
 -- Expired queue visibility or source lease must never commit.
 update pgmq.q_trend_collect set vt=now()-interval '1 second' where (message->>'source_id')::uuid=sid;
 claim=public.collector_cloud_take('expired-worker','ftc');
 update public.collector_cloud_routes set lease_until=now()-interval '1 second' where source_id=sid;
 begin
  perform public.collector_cloud_commit(sid,'expired-worker',(claim->>'lease_token')::uuid,bundle,'expired-test');
  raise exception 'expired lease accepted';
 exception when others then if sqlerrm='expired lease accepted' then raise; end if; end;
 update public.collector_cloud_routes set lease_until=transaction_timestamp()+interval '1 microsecond' where source_id=sid;
 update pgmq.q_trend_collect set vt=transaction_timestamp()+interval '1 microsecond' where msg_id=(claim->>'msg_id')::bigint;
 begin
  perform public.collector_cloud_commit(sid,'expired-worker',(claim->>'lease_token')::uuid,bundle,'transaction-time-test');
  raise exception 'transaction-stable time accepted expired lease';
 exception when others then if sqlerrm='transaction-stable time accepted expired lease' then raise; end if; end;
end $$;
do $$
declare sid uuid; claim jsonb; bundle jsonb; result jsonb; backlog uuid; cur jsonb;
 target text='https://www.ftc.gov/news-events/news/press-releases/__collector_rollback_test__';
begin
 select source_id into sid from public.collector_edge_sources where slug='ftc';
 update public.collector_cloud_routes set worker=null,lease_until=null,lease_token=null where source_id=sid;
 update pgmq.q_trend_collect set vt=clock_timestamp()-interval '1 second' where (message->>'source_id')::uuid=sid;
 claim=public.collector_cloud_take('parking-worker','ftc');
 cur=jsonb_build_object('page','https://www.ftc.gov/feeds/press-release-consumer-protection.xml','offset',0);
 bundle=jsonb_build_object('cursor',cur||'{"offset":1}'::jsonb,'operations','[]'::jsonb,
  'failure',jsonb_build_object('url',target,'title','Synthetic rollback failure','reason','unsupported_type','cursor',cur),
  'result',jsonb_build_object('since',claim->>'since','until',claim->>'until','status','partial','reason','detail_failure_parked','failed_url',target));
 result=public.collector_cloud_commit(sid,'parking-worker',(claim->>'lease_token')::uuid,bundle,'parking-rollback-test');
 select id into strict backlog from public.collector_edge_backlog where source_id=sid and url=target and not resolved;
 if (select cursor->>'offset' from public.collector_cloud_routes where source_id=sid)<>'1' then raise exception 'parking did not advance'; end if;
 update pgmq.q_trend_collect set vt=clock_timestamp()+interval '2 hours' where (message->>'source_id')::uuid=sid;
 update pgmq.q_trend_collect set vt=clock_timestamp()-interval '1 second' where message->>'backlog_id'=backlog::text;
 claim=public.collector_cloud_take('backlog-worker','ftc');
 if claim->>'backlog_id' is distinct from backlog::text or claim#>>'{detail,url}'<>target then raise exception 'backlog not consumable'; end if;
 bundle=jsonb_build_object('cursor',null,'operations','[]'::jsonb,'backlog_resolved',false,
  'result',jsonb_build_object('since',claim->>'since','until',claim->>'until','status','failed','reason','http_503','failed_url',target));
 result=public.collector_cloud_commit(sid,'backlog-worker',(claim->>'lease_token')::uuid,bundle,'backlog-rollback-test');
 if result->>'retry_after_seconds'<>'3600' or (select resolved from public.collector_edge_backlog where id=backlog) then raise exception 'failed backlog lost'; end if;
 if (select cursor->>'offset' from public.collector_cloud_routes where source_id=sid)<>'1' then raise exception 'backlog overwrote main cursor'; end if;
end $$;
select 'cloud connector rollback checks passed' as result;
