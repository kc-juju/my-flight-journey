-- My Flight Journey — Supabase setup
--
-- Run this once in the Supabase SQL editor. It creates the two tables, the
-- photo bucket, and the row-level security that makes a public anon key safe:
-- anyone may read, anyone may sign the guestbook, only signed-in accounts may
-- add or remove photos.

-- ---------------------------------------------------------------- photos --

create table if not exists public.journey_photos (
  id                   uuid primary key default gen_random_uuid(),
  journey_slug         text        not null,
  storage_path         text        not null unique,
  taken_local          text,                  -- naive EXIF clock, "2025-10-06T14:03"
  taken_offset_minutes integer,               -- EXIF UTC offset, when present
  taken_instant        timestamptz,           -- what we settled on
  time_basis           text,                  -- exif-offset | itinerary | unplaced
  place_id             text,
  caption              text,
  owner                uuid references auth.users(id) on delete set null
                       default auth.uid(),
  created_at           timestamptz not null default now()
);

create index if not exists journey_photos_slug_idx
  on public.journey_photos (journey_slug, taken_instant);

alter table public.journey_photos enable row level security;

drop policy if exists "photos are public" on public.journey_photos;
create policy "photos are public"
  on public.journey_photos for select
  using (true);

drop policy if exists "signed-in users add photos" on public.journey_photos;
create policy "signed-in users add photos"
  on public.journey_photos for insert
  to authenticated
  with check (auth.uid() = owner);

drop policy if exists "owners remove their photos" on public.journey_photos;
create policy "owners remove their photos"
  on public.journey_photos for delete
  to authenticated
  using (auth.uid() = owner);

drop policy if exists "owners edit their photos" on public.journey_photos;
create policy "owners edit their photos"
  on public.journey_photos for update
  to authenticated
  using (auth.uid() = owner)
  with check (auth.uid() = owner);

-- ------------------------------------------------------------- guestbook --

create table if not exists public.guestbook (
  id         uuid primary key default gen_random_uuid(),
  name       text not null check (char_length(trim(name))  between 1 and 40),
  message    text not null check (char_length(trim(message)) between 1 and 800),
  created_at timestamptz not null default now()
);

create index if not exists guestbook_created_idx on public.guestbook (created_at desc);

alter table public.guestbook enable row level security;

drop policy if exists "guestbook is public" on public.guestbook;
create policy "guestbook is public"
  on public.guestbook for select
  using (true);

-- Anyone may sign it. The length checks above are the only gate; moderation
-- is manual, which is proportionate for a personal site.
drop policy if exists "anyone may sign" on public.guestbook;
create policy "anyone may sign"
  on public.guestbook for insert
  to anon, authenticated
  with check (true);

drop policy if exists "signed-in users moderate" on public.guestbook;
create policy "signed-in users moderate"
  on public.guestbook for delete
  to authenticated
  using (true);

-- --------------------------------------------------------------- storage --

insert into storage.buckets (id, name, public)
values ('journey-photos', 'journey-photos', true)
on conflict (id) do update set public = true;

drop policy if exists "photo files are public" on storage.objects;
create policy "photo files are public"
  on storage.objects for select
  using (bucket_id = 'journey-photos');

drop policy if exists "signed-in users upload photos" on storage.objects;
create policy "signed-in users upload photos"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'journey-photos');

drop policy if exists "signed-in users delete photos" on storage.objects;
create policy "signed-in users delete photos"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'journey-photos');
