-- Migration 006 — run this in the Supabase SQL editor after 005.
--
-- Migration 005 lets a booked leg be changed. This one lets a leg be added:
-- a positioning flight bought after the fact, a train the log cannot know
-- about, a replacement the airline put you on when it cancelled the original.
--
-- Added legs are laid over the built data exactly as corrections are, and
-- sorted into the itinerary by their departure, so nothing has to say where
-- they belong. Deleting the row removes the leg; there is no other state.
--
-- Where a leg goes is written by place id, not by name — the same ids the
-- built atlas uses — so an addition cannot invent a location.

create table if not exists public.segment_additions (
  journey_slug  text not null,
  -- Formed by the browser as 'added-<timestamp>-<from><to>', unique within
  -- a journey, and stable so an edit can find it again.
  segment_id    text not null,

  mode          text not null default 'flight'
                check (mode in ('flight', 'train', 'car', 'bus', 'ferry', 'walk', 'surface')),

  from_place_id text not null check (length(btrim(from_place_id)) between 1 and 64),
  to_place_id   text not null check (length(btrim(to_place_id)) between 1 and 64),

  -- Local clock at each end, as the build writes them: '2027-01-14T09:40'.
  departure     text check (departure is null or departure ~ '^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$'),
  arrival       text check (arrival   is null or arrival   ~ '^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$'),

  reference     text check (reference is null or length(btrim(reference)) between 1 and 24),
  operator      text check (operator  is null or length(btrim(operator))  between 1 and 60),
  vehicle       text check (vehicle   is null or length(btrim(vehicle))   between 1 and 60),
  cabin         text check (cabin     is null or length(btrim(cabin))     between 1 and 40),
  note          text check (note      is null or length(btrim(note))      between 1 and 500),

  updated_at    timestamptz not null default now(),
  updated_by    text,

  primary key (journey_slug, segment_id),

  -- A leg that goes nowhere is not a leg.
  constraint segment_additions_moves check (from_place_id <> to_place_id)
);

alter table public.segment_additions enable row level security;

drop policy if exists "added legs are public" on public.segment_additions;
create policy "added legs are public"
  on public.segment_additions for select
  using (true);

drop policy if exists "owners may add a leg" on public.segment_additions;
create policy "owners may add a leg"
  on public.segment_additions for insert
  with check (public.is_owner());

drop policy if exists "owners may amend an added leg" on public.segment_additions;
create policy "owners may amend an added leg"
  on public.segment_additions for update
  using (public.is_owner())
  with check (public.is_owner());

drop policy if exists "owners may remove an added leg" on public.segment_additions;
create policy "owners may remove an added leg"
  on public.segment_additions for delete
  using (public.is_owner());

create or replace function public.stamp_segment_addition()
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

drop trigger if exists segment_additions_stamp on public.segment_additions;
create trigger segment_additions_stamp
  before insert or update on public.segment_additions
  for each row execute function public.stamp_segment_addition();
