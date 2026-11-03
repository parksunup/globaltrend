-- The team UI grants publication actions only to administrators. Restore the
-- database boundary as well; the previous editor allowance left the UI and
-- direct RPC permissions inconsistent and invalidated lifecycle tests.
do $$
declare
  definition text;
  editor_guard text := 'if p_action in (''publish'',''unpublish'') and not private.is_team_member(''editor'') then';
  admin_guard text := 'if p_action in (''publish'',''unpublish'') and not private.is_team_member(''admin'') then';
  editor_legal_guard text := 'if auth.uid() is null or not private.is_team_member(''editor'') then raise insufficient_privilege using message=''Active editor is required''; end if;';
  admin_legal_guard text := 'if auth.uid() is null or not private.is_team_member(''admin'') then raise insufficient_privilege using message=''Active administrator is required''; end if;';
begin
  select pg_get_functiondef('private.apply_publication_workspace_action(text,text,uuid,bigint,jsonb)'::regprocedure)
    into definition;
  if position(editor_guard in definition) = 0 then
    raise exception 'Expected editor publication guard not found';
  end if;
  execute replace(definition, editor_guard, admin_guard);

  select pg_get_functiondef('private.advance_legal_review(uuid,text,boolean)'::regprocedure)
    into definition;
  if position(editor_legal_guard in definition) = 0 then
    raise exception 'Expected editor legal publication guard not found';
  end if;
  execute replace(definition, editor_legal_guard, admin_legal_guard);
end $$;
