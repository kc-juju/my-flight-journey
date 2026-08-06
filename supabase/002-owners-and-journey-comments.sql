-- Migration 002 — run this in the Supabase SQL editor after schema.sql.
--
-- Two changes:
--   1. Only listed owners may add or remove photos. Without this, anyone who
--      signs in with any email address can upload to your journeys, because
--      "authenticated" means nothing more than "proved they can read an inbox".
--      Any number of addresses can be owners, and any owner can remove any
--      photo — the point is a shared album, not private lockers.
--   2. Comments can belong to a journey, so each journey carries its own
--      thread instead of everything landing in one global guestbook.

-- ---------------------------------------------------------------- owners --

create table if not exists public.site_owners (
  email text primary key
);

alter table public.site_owners enable row level security;
-- Nobody reads this table from the browser; the checks below run as definer.

-- List every address that may manage photos. The magic link is sent to these
-- inboxes, so each has to be one you can actually open. Add as many as you
-- like — two people sharing a trip, a work address and a personal one.
--
-- Matching is case-insensitive (see is_owner below).
insert into public.site_owners (email) values
  ('jimwu@synology.com')
  -- , ('someone.else@example.com')
on conflict (email) do nothing;

-- Later, without re-running this file:
--   add:    insert into public.site_owners (email) values ('new@example.com');
--   remove: delete from public.site_owners where lower(email) = 'old@example.com';
--   list:   select * from public.site_owners;

create or replace function public.is_owner()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.site_owners
    where lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;

revoke all on function public.is_owner() from public;
grant execute on function public.is_owner() to authenticated, anon;

-- ------------------------------------------------------- photo policies --

drop policy if exists "signed-in users add photos" on public.journey_photos;
create policy "owners add photos"
  on public.journey_photos for insert
  to authenticated
  with check (public.is_owner() and auth.uid() = owner);

drop policy if exists "owners remove their photos" on public.journey_photos;
create policy "owners remove photos"
  on public.journey_photos for delete
  to authenticated
  using (public.is_owner());

drop policy if exists "owners edit their photos" on public.journey_photos;
create policy "owners edit photos"
  on public.journey_photos for update
  to authenticated
  using (public.is_owner())
  with check (public.is_owner());

drop policy if exists "signed-in users upload photos" on storage.objects;
create policy "owners upload photo files"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'journey-photos' and public.is_owner());

drop policy if exists "signed-in users delete photos" on storage.objects;
create policy "owners delete photo files"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'journey-photos' and public.is_owner());

-- --------------------------------------------------- per-journey comments --

alter table public.guestbook
  add column if not exists journey_slug text;

create index if not exists guestbook_journey_idx
  on public.guestbook (journey_slug, created_at desc);

-- Anyone may still leave a message, on a journey or on the guestbook page.
-- Only an owner may remove one.
drop policy if exists "signed-in users moderate" on public.guestbook;
create policy "owners moderate"
  on public.guestbook for delete
  to authenticated
  using (public.is_owner());
