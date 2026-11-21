-- Pause the European Commission and European Parliament collection routes
-- requested on 2026-11-17. Existing stored items and draft jobs are preserved.
update public.sources
set is_active = false,
    updated_at = clock_timestamp()
where id in (
  '5e5d193b-d98c-524a-9949-c35e8938caad'::uuid,
  '0d91c2b9-8884-5533-95c2-09469c6db19b'::uuid
);
