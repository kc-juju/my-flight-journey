-- Migration 007 — run this in the Supabase SQL editor after 006.
--
-- Migration 006 lets a leg be added, but only between places the atlas
-- already had — which rules out the one case that matters most: a journey
-- somewhere new. This table holds the places themselves.
--
-- A place is only ever as good as where its coordinates came from, so the
-- source is recorded with it. The site fills that in when the place is
-- chosen from the vendored airport list; anything typed by hand says so.

create table if not exists public.place_additions (
  id            text primary key check (length(btrim(id)) between 1 and 64),
  name          text not null check (length(btrim(name)) between 1 and 80),

  -- IATA code where there is one. Towns reached on the ground have none.
  code          text check (code is null or code ~ '^[A-Z0-9]{3}$'),
  airport_name  text check (airport_name is null or length(btrim(airport_name)) between 1 and 120),

  country       text not null check (length(btrim(country)) between 1 and 60),
  country_code  text not null check (country_code ~ '^[A-Z]{2}$'),

  lat           double precision not null check (lat between -90 and 90),
  lon           double precision not null check (lon between -180 and 180),

  -- Scenery rather than a settlement: counted as somewhere reached, not as
  -- a city. Matches the built atlas's own distinction.
  kind          text check (kind is null or kind = 'landscape'),

  -- Where the position came from. Required: a coordinate with no provenance
  -- is how an atlas starts lying.
  source        text not null check (length(btrim(source)) between 1 and 200),

  updated_at    timestamptz not null default now(),
  updated_by    text
);

alter table public.place_additions enable row level security;

drop policy if exists "added places are public" on public.place_additions;
create policy "added places are public"
  on public.place_additions for select
  using (true);

drop policy if exists "owners may add a place" on public.place_additions;
create policy "owners may add a place"
  on public.place_additions for insert
  with check (public.is_owner());

drop policy if exists "owners may amend a place" on public.place_additions;
create policy "owners may amend a place"
  on public.place_additions for update
  using (public.is_owner())
  with check (public.is_owner());

drop policy if exists "owners may remove a place" on public.place_additions;
create policy "owners may remove a place"
  on public.place_additions for delete
  using (public.is_owner());

create or replace function public.stamp_place_addition()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.updated_at := now();
  new.updated_by := coalesce(auth.jwt() ->> 'email', 'unknown');
  return new;
end;
$$;

drop trigger if exists place_additions_stamp on public.place_additions;
create trigger place_additions_stamp
  before insert or update on public.place_additions
  for each row execute function public.stamp_place_addition();
