revoke select on public.comparison_cells,public.report_provision_links,public.review_states from anon,authenticated;
revoke select(reviewed_by,reviewed_at,note) on public.review_states from anon,authenticated;
grant select(id,criterion_id,law_version_id,summary_ko,status,created_at,updated_at)
 on public.comparison_cells to anon,authenticated;
grant select(report_id,provision_node_id,mention_text,confidence)
 on public.report_provision_links to anon,authenticated;
grant select(entity_type,entity_id,status,updated_at) on public.review_states to anon,authenticated;
