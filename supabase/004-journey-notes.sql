-- Migration 004 — run this in the Supabase SQL editor after 003.
--
-- The same row that overrules a journey's title can also carry a short note
-- about the trip, written after the fact: why it happened, what it was
-- actually like. One row per journey, one set of policies, rather than a
-- second table that says the same thing about the same thing.
--
-- A note without a rename is normal, so the title becomes optional.

alter table public.journey_titles add column if not exists note text;

alter table public.journey_titles alter column title drop not null;

alter table public.journey_titles drop constraint if exists journey_titles_title_check;
alter table public.journey_titles add constraint journey_titles_title_check
  check (title is null or length(btrim(title)) between 1 and 120);

alter table public.journey_titles drop constraint if exists journey_titles_note_check;
alter table public.journey_titles add constraint journey_titles_note_check
  check (note is null or length(btrim(note)) between 1 and 2000);

-- A row with neither is just clutter; the interface deletes it, and this
-- stops one being written in the first place.
alter table public.journey_titles drop constraint if exists journey_titles_not_empty;
alter table public.journey_titles add constraint journey_titles_not_empty
  check (title is not null or note is not null);
