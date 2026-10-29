-- Anonymous browser counts. No IP address, user agent, or account ID is stored.
create schema if not exists private;

create table public.site_visit_days (
  visitor_id uuid not null,
  visited_on date not null,
  primary key (visitor_id, visited_on)
);
alter table public.site_visit_days enable row level security;
revoke all on public.site_visit_days from public, anon, authenticated;
grant insert on public.site_visit_days to anon, authenticated;
create policy "record current Seoul day" on public.site_visit_days
  for insert to anon, authenticated
  with check (visited_on = (now() at time zone 'Asia/Seoul')::date);

create table private.site_visitor_ids (
  visitor_id uuid primary key
);
alter table private.site_visitor_ids enable row level security;
revoke all on private.site_visitor_ids from public, anon, authenticated;

create table public.site_visit_daily_totals (
  visited_on date primary key,
  visitor_count bigint not null default 0 check (visitor_count >= 0)
);
alter table public.site_visit_daily_totals enable row level security;
revoke all on public.site_visit_daily_totals from public, anon, authenticated;
grant select on public.site_visit_daily_totals to anon, authenticated;
create policy "read daily totals" on public.site_visit_daily_totals
  for select to anon, authenticated using (true);

create table public.site_visit_lifetime_total (
  singleton boolean primary key default true check (singleton),
  visitor_count bigint not null default 0 check (visitor_count >= 0)
);
insert into public.site_visit_lifetime_total(singleton, visitor_count) values (true, 0);
alter table public.site_visit_lifetime_total enable row level security;
revoke all on public.site_visit_lifetime_total from public, anon, authenticated;
grant select on public.site_visit_lifetime_total to anon, authenticated;
create policy "read lifetime total" on public.site_visit_lifetime_total
  for select to anon, authenticated using (true);

create function private.count_site_visit()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into private.site_visitor_ids(visitor_id) values (new.visitor_id)
    on conflict do nothing;
  if found then
    update public.site_visit_lifetime_total
      set visitor_count = visitor_count + 1 where singleton = true;
  end if;
  insert into public.site_visit_daily_totals(visited_on, visitor_count)
    values (new.visited_on, 1)
    on conflict (visited_on) do update
      set visitor_count = public.site_visit_daily_totals.visitor_count + 1;
  return new;
end;
$$;
revoke all on function private.count_site_visit() from public, anon, authenticated;
create trigger count_site_visit after insert on public.site_visit_days
  for each row execute function private.count_site_visit();
