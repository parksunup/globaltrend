begin;
select plan(9);
select ok(not has_function_privilege('anon','public.podcast_session_step(text,text,jsonb)','execute'),'anonymous callers cannot access sessions');
select ok(not has_function_privilege('authenticated','public.podcast_session_step(text,text,jsonb)','execute'),'team logins cannot access sessions');
select ok(not has_table_privilege('anon','private.podcast_session_state','select'),'anonymous callers cannot read ciphertext');
select ok(not has_table_privilege('authenticated','private.podcast_session_state','select'),'team logins cannot read ciphertext');
select ok(not has_table_privilege('service_role','private.podcast_session_state','insert'),'worker cannot create additional session rows');
select ok(has_table_privilege('service_role','private.podcast_session_state','update'),'worker may update the leased session');
select ok(not (select prosecdef from pg_proc where oid='public.podcast_session_step(text,text,jsonb)'::regprocedure),'session function uses caller privileges');
select ok((select relrowsecurity from pg_class where oid='private.podcast_session_state'::regclass),'private session has RLS defense in depth');
do $$
declare a jsonb; e jsonb=jsonb_build_object('format',1,'key_id',repeat('c',16),'nonce',repeat('B',16),'ciphertext',repeat('A',64));
begin
  update private.podcast_session_state set enabled=true,test_until=now()+interval '1 hour',envelope=null,version=0,
    lease_run=null,lease_until=null,consecutive_failures=0;
  perform set_config('request.jwt.claims','{"role":"service_role"}',true);
  set local role service_role;
  a=public.podcast_session_step('1:1','acquire');
  if a->>'version'<>'0' or a->>'auth_only'<>'true' then raise exception 'trial acquisition failed'; end if;
  if public.podcast_session_step('2:1','acquire') is not null then raise exception 'double lease'; end if;
  begin
    perform public.podcast_session_step('1:1','save',jsonb_build_object('version',1,'envelope',e));
    raise exception 'stale version accepted';
  exception when raise_exception then if sqlerrm<>'session version changed' then raise; end if; end;
  perform public.podcast_session_step('1:1','save',jsonb_build_object('version',0,'envelope',e));
  a=public.podcast_session_step('2:1','acquire');
  if a->'envelope' is distinct from e or a->>'version'<>'1' then raise exception 'rotation lost'; end if;
  begin
    perform public.podcast_session_step('2:1','save',jsonb_build_object('version',1,'envelope',jsonb_set(e,'{key_id}',to_jsonb(repeat('d',16)))));
    raise exception 'wrong key accepted';
  exception when raise_exception then if sqlerrm<>'invalid encrypted session' then raise; end if; end;
  begin
    perform public.podcast_session_step('2:1','save','{"version":1,"envelope":{"cookies":"plaintext"}}');
    raise exception 'plaintext accepted';
  exception when raise_exception then if sqlerrm<>'invalid encrypted session' then raise; end if; end;
  perform public.podcast_session_step('2:1','save',jsonb_build_object('version',1,'envelope',e));
  perform public.podcast_session_step('3:1','acquire');
  update private.podcast_session_state set lease_until=now()-interval '1 second' where id;
  begin
    perform public.podcast_session_step('3:1','save',jsonb_build_object('version',2,'envelope',e));
    raise exception 'expired lease accepted';
  exception when raise_exception then if sqlerrm<>'session lease lost' then raise; end if; end;
  for i in 4..6 loop
    perform public.podcast_session_step(i||':1','acquire');
    perform public.podcast_session_step(i||':1','fail','{"category":"auth"}');
  end loop;
  if (select enabled from private.podcast_session_state where id) then raise exception 'repeated failures not paused'; end if;
  if (select version from private.podcast_session_state where id)<>2 then raise exception 'failure overwrote state'; end if;
  update private.podcast_session_state set enabled=true,test_until=now()-interval '1 second' where id;
  if public.podcast_session_step('7:1','acquire') is not null then raise exception 'expired trial continued'; end if;
  if (select enabled from private.podcast_session_state where id) then raise exception 'deadline did not pause'; end if;
  reset role;
end;
$$;
select pass('leases, version conflicts, key binding, plaintext rejection, failure pause and trial deadline');
select * from finish();
rollback;
