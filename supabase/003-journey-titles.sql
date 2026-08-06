-- Migration 003 — run this in the Supabase SQL editor after 002.
--
-- Titles are generated from the itinerary, which is right often enough to be
-- the default and wrong often enough to need overruling: a trip the build
-- calls "Philippines · Türkiye · France +2" is, to the person who took it,
-- 南法北義菲律賓. This table holds those corrections, keyed by the journey's
-- slug, so a rename survives a rebuild and shows for everyone who visits.
--
-- Anyone may read a title. Only an address in site_owners may set one, which
-- is the same rule the photos already follow.

create table if not exists public.journey_titles (
  journey_slug text primary key,
  title        text not null check (length(btrim(title)) between 1 and 120),
  updated_at   timestamptz not null default now(),
  updated_by   text
);

alter table public.journey_titles enable row level security;

drop policy if exists "titles are public" on public.journey_titles;
create policy "titles are public"
  on public.journey_titles for select
  using (true);

drop policy if exists "owners may set a title" on public.journey_titles;
create policy "owners may set a title"
  on public.journey_titles for insert
  with check (public.is_owner());

drop policy if exists "owners may change a title" on public.journey_titles;
create policy "owners may change a title"
  on public.journey_titles for update
  using (public.is_owner())
  with check (public.is_owner());

-- Deleting the row restores the generated title rather than blanking it.
drop policy if exists "owners may restore a title" on public.journey_titles;
create policy "owners may restore a title"
  on public.journey_titles for delete
  using (public.is_owner());

-- Who last changed it, without trusting the browser to say.
create or replace function public.stamp_journey_title()
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

drop trigger if exists journey_titles_stamp on public.journey_titles;
create trigger journey_titles_stamp
  before insert or update on public.journey_titles
  for each row execute function public.stamp_journey_title();
