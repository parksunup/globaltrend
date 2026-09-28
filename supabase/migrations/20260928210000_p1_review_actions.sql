-- Persist team review decisions without publishing content automatically.

create table public.review_states (
  entity_type text not null check (entity_type in ('sources','laws','criteria')),
  entity_id uuid not null,
  status text not null default 'unreviewed'
    check (status in ('unreviewed','in_review','approved','rejected')),
  note text,
  reviewed_by uuid references public.profiles(id),
  reviewed_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (entity_type, entity_id),
  check (status <> 'rejected' or nullif(btrim(note), '') is not null)
);

alter table public.review_states enable row level security;

create policy review_states_team_read on public.review_states for select to authenticated
  using ((select private.is_team_member('reviewer')));

grant select on public.review_states to authenticated;

create or replace function public.handle_new_user_profile()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
begin
  insert into public.profiles (id, email, display_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data ->> 'display_name', new.email))
  on conflict (id) do update
  set email = excluded.email,
      updated_at = now();
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_profile on auth.users;
create trigger on_auth_user_created_profile
  after insert or update of email on auth.users
  for each row execute function public.handle_new_user_profile();

insert into public.profiles (id, email, display_name)
select u.id, u.email, coalesce(u.raw_user_meta_data ->> 'display_name', u.email)
from auth.users u
on conflict (id) do update
set email = excluded.email,
    updated_at = now();

create or replace function public.set_review_state(
  p_entity_type text,
  p_entity_id uuid,
  p_status text,
  p_note text default null
)
returns public.review_states
language plpgsql
security definer
set search_path = public, private, pg_catalog
as $$
declare
  v_state public.review_states;
  v_note text := nullif(btrim(p_note), '');
begin
  if not private.is_team_member('reviewer') then
    raise insufficient_privilege using message = 'Active reviewer membership is required';
  end if;

  if p_entity_type not in ('sources','laws','criteria') then
    raise invalid_parameter_value using message = 'Unsupported review entity type';
  end if;

  if p_status not in ('in_review','approved','rejected') then
    raise invalid_parameter_value using message = 'Unsupported review status';
  end if;

  if p_status = 'rejected' and v_note is null then
    raise invalid_parameter_value using message = 'A rejection note is required';
  end if;

  if not (
    (p_entity_type = 'sources' and exists (select 1 from public.sources where id = p_entity_id))
    or (p_entity_type = 'laws' and exists (select 1 from public.legal_instruments where id = p_entity_id))
    or (p_entity_type = 'criteria' and exists (select 1 from public.criteria where id = p_entity_id))
  ) then
    raise invalid_parameter_value using message = 'Review target does not exist';
  end if;

  insert into public.review_states (entity_type, entity_id, status, note, reviewed_by, reviewed_at, updated_at)
  values (p_entity_type, p_entity_id, p_status, v_note, auth.uid(), now(), now())
  on conflict (entity_type, entity_id) do update
  set status = excluded.status,
      note = excluded.note,
      reviewed_by = excluded.reviewed_by,
      reviewed_at = excluded.reviewed_at,
      updated_at = excluded.updated_at
  returning * into v_state;

  insert into public.review_events (entity_type, entity_id, action, actor_id, note)
  values (p_entity_type, p_entity_id, p_status, auth.uid(), v_note);

  return v_state;
end;
$$;

revoke all on function public.set_review_state(text, uuid, text, text) from public;
grant execute on function public.set_review_state(text, uuid, text, text) to authenticated;
