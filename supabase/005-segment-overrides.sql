-- Migration 005 — run this in the Supabase SQL editor after 004.
--
-- A booked flight is not a fact yet. Airlines move them: a departure slides
-- two hours, an aircraft swaps, a leg is cancelled outright. Until now the
-- only way to record that was to rebuild the site, because every segment
-- comes out of the flight log at build time.
--
-- This table holds corrections to a segment, keyed by the journey slug and
-- the segment's id, and the site merges them over the built data as it
-- loads. The log stays the record of what was booked; this is the record of
-- what the airline did to it afterwards.
--
-- Only fields an airline can change are here. Where a leg goes and what it
-- is made of are not corrections, they are a different journey.

create table if not exists public.segment_overrides (
  journey_slug text not null,
  segment_id   text not null,

  -- Local clock at each end, ISO 8601 without a zone, exactly as the build
  -- writes them: '2027-01-14T09:40'.
  departure    text check (departure is null or departure ~ '^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$'),
  arrival      text check (arrival   is null or arrival   ~ '^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$'),

  -- Flight number, when the airline rebooks you onto another service.
  reference    text check (reference is null or length(btrim(reference)) between 1 and 24),

  -- Aircraft type, when the metal changes.
  vehicle      text check (vehicle is null or length(btrim(vehicle)) between 1 and 60),

  -- Cancelled and not replaced. The segment stays visible, struck through,
  -- and drops out of every derived figure — the same treatment the build
  -- gives a leg that was booked and not taken.
  dropped      boolean,

  -- Why it changed, in the owner's words. Shown with the change.
  note         text check (note is null or length(btrim(note)) between 1 and 500),

  updated_at   timestamptz not null default now(),
  updated_by   text,

  primary key (journey_slug, segment_id),

  -- A row that corrects nothing should not exist; deleting it is how a
  -- correction is undone.
  constraint segment_overrides_not_empty check (
    departure is not null
    or arrival is not null
    or reference is not null
    or vehicle is not null
    or dropped is not null
    or note is not null
  )
);

alter table public.segment_overrides enable row level security;

drop policy if exists "segment changes are public" on public.segment_overrides;
create policy "segment changes are public"
  on public.segment_overrides for select
  using (true);

drop policy if exists "owners may record a segment change" on public.segment_overrides;
create policy "owners may record a segment change"
  on public.segment_overrides for insert
  with check (public.is_owner());

drop policy if exists "owners may amend a segment change" on public.segment_overrides;
create policy "owners may amend a segment change"
  on public.segment_overrides for update
  using (public.is_owner())
  with check (public.is_owner());

-- Deleting the row restores whatever the build said, rather than blanking it.
drop policy if exists "owners may undo a segment change" on public.segment_overrides;
create policy "owners may undo a segment change"
  on public.segment_overrides for delete
  using (public.is_owner());

-- Who last changed it, without trusting the browser to say.
create or replace function public.stamp_segment_override()
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

drop trigger if exists segment_overrides_stamp on public.segment_overrides;
create trigger segment_overrides_stamp
  before insert or update on public.segment_overrides
  for each row execute function public.stamp_segment_override();
