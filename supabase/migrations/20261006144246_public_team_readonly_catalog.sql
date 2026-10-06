-- Let visitors inspect the three catalog lists shown on /team without signing in.
-- Draft reports, source bodies, legal text, review notes, and all writes stay restricted.
create policy legal_instruments_catalog_read on public.legal_instruments
  for select to anon using (true);

create policy criteria_sets_catalog_read on public.criteria_sets
  for select to anon using (true);

create policy criteria_catalog_read on public.criteria
  for select to anon using (true);

-- The public board needs only a review status, never reviewer identity or notes.
grant select (entity_type, entity_id, status, reviewed_at)
  on public.review_states to anon;

create policy review_states_public_status_read on public.review_states
  for select to anon using (true);
