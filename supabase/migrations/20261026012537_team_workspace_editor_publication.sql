-- Let authenticated editors publish from their own team workroom. Reviewers
-- remain read-only; administrators retain the same capabilities as before.
do $$
declare
  definition text;
  before_text text;
begin
  select pg_get_functiondef('private.apply_publication_workspace_action(text,text,uuid,bigint,jsonb)'::regprocedure)
    into definition;
  before_text := 'if p_action in (''publish'',''unpublish'') and not private.is_team_member(''admin'') then';
  if position(before_text in definition)=0 then raise exception 'Publication editor guard not found'; end if;
  definition := replace(definition,before_text,
    'if p_action in (''publish'',''unpublish'') and not private.is_team_member(''editor'') then');
  execute definition;

  select pg_get_functiondef('private.advance_legal_review(uuid,text,boolean)'::regprocedure)
    into definition;
  before_text := 'if auth.uid() is null or not private.is_team_member(''admin'') then raise insufficient_privilege using message=''Active administrator is required''; end if;';
  if position(before_text in definition)=0 then raise exception 'Legal publication editor guard not found'; end if;
  definition := replace(definition,before_text,
    'if auth.uid() is null or not private.is_team_member(''editor'') then raise insufficient_privilege using message=''Active editor is required''; end if;');
  execute definition;
end $$;

-- Keep the legal instrument-level public flag in sync when the last published
-- version is withdrawn.
do $$
declare
  definition text;
  before_text text;
begin
  select pg_get_functiondef('private.apply_publication_workspace_action(text,text,uuid,bigint,jsonb)'::regprocedure)
    into definition;
  before_text := 'update public.comparison_cells set status=''unreviewed'' where law_version_id=p_entity_id;';
  if position(before_text in definition)=0 then raise exception 'Legal unpublish block not found'; end if;
  definition := replace(definition,before_text,
    before_text||E'\n   update public.legal_instruments set is_published=false where id=v.legal_instrument_id and not exists(select 1 from public.law_versions where legal_instrument_id=v.legal_instrument_id and status=''published'');');
  execute definition;
end $$;
