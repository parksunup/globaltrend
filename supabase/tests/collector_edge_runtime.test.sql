begin;
select plan(4);
select is((select enabled from public.collector_edge_control where singleton),false,'runtime is disabled after migration');
select is(public.collector_edge_enqueue('test'),0,'disabled scheduler does not enqueue work');
select is(has_function_privilege('anon','public.collector_edge_take()','execute'),false,'anonymous users cannot claim collector messages');
select is(has_function_privilege('authenticated','public.collector_edge_take()','execute'),false,'browser sessions cannot claim collector messages');
select * from finish();
rollback;
