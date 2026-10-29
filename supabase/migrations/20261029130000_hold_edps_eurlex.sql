-- User deferred EDPS and EUR-Lex. Preserve discovery/failure history,
-- source permissions history, all queue/cursor/lease state and the other 18.
update public.sources s
set is_active=false,parser_config=s.parser_config || jsonb_build_object(
 'hold_reason','user_deferred_2026_10_29','collection_status','held_by_user')
from public.collector_edge_sources e
where e.source_id=s.id and e.slug in ('edps','eur-lex');
