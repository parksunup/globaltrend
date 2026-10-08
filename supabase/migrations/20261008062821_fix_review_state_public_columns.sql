-- Public visitors need only the review status shown on /team.
-- A table-level SELECT grant also exposes note and reviewer identity, even
-- when a column-level grant is present. Remove it before restoring safe columns.
revoke select on public.review_states from anon;
grant select (entity_type, entity_id, status, reviewed_at)
  on public.review_states to anon;
