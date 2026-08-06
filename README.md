# My Flight Journey

A personal travel atlas. Not a flight tracker — the primary entity is a
**Journey**, and a flight is only one kind of segment within it. The model also
carries trains, cars, buses, ferries, walking, and `surface` for movement the
log records without saying how.

**Live:** https://jim841019g.github.io/my-flight-journey/

## Stack

React 19 · TypeScript · Vite · TailwindCSS · React Router · Leaflet · Framer Motion

## Running it

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # type-check + production bundle
```

## Structure

```
src/
  types/journey.ts        Journey / Segment / Place / Collection interfaces
  data/journeys.json      the atlas data — generated, see below
  data/image-credits.json photographer + licence for every city photo
  lib/geo.ts              great-circle sampling, distance, bounds
  lib/atlas.ts            all derived metrics (nothing is authored twice)
  lib/format.ts           dates, durations, per-mode labels/icons/colours
  lib/asset.ts            base-path-aware public asset URLs
  hooks/useAtlas.tsx      loads the data once, memoises derived metrics
  components/
    layout/               Navbar, Footer
    map/                  WorldMap, JourneyRoutes, JourneyPopup
    journey/              JourneyCard, Timeline, SegmentCard
    stats/                StatisticsCard, ImageCredits
    ui/                   Icon
  pages/                  Map, Journeys, Journey detail, Stats
```

Design tokens in `tailwind.config.js` are transcribed from the Stitch
prototype — palette, spacing scale and type ramp are not re-invented.

Every number the interface shows (days, distance, cities, countries, hours) is
computed in `lib/atlas.ts` from the segment list. None of it is stored, so the
figures cannot drift out of agreement with each other.

## Where the data comes from

`src/data/journeys.json` is generated, not hand-written:

```bash
python3 scripts/build-journeys.py
```

| Field | Source |
| --- | --- |
| Flights, dates, aircraft, cabin | Flighty export |
| Tail numbers, corrected dates | Flightradar24 flight-diary export |
| Airport coordinates | [OurAirports](https://ourairports.com/data/) |
| Timezones (for honest durations) | `timezonefinder` + `zoneinfo` |
| City photos | Wikimedia Commons, free licences only |

### Grouping legs into journeys

Taiwan (TPE/TSA) is home. A journey opens on the first leg after being home and
closes when a leg lands back home; a gap longer than 60 days away also splits
one. 102 legs become 34 journeys.

### Judgement calls worth knowing about

- **Distances are great-circle**, computed from airport coordinates. Real tracks
  are longer.
- **Durations are timezone-aware.** The exports record local clocks at each end;
  subtracting them directly is wrong for anything crossing a timezone.
- **One leg was re-dated.** Flighty dates AY131 HEL–SIN a day earlier than
  Flightradar24 does. Flighty's date makes the itinerary impossible (it would
  reach Singapore before leaving Warsaw for Helsinki), so the FR24 date wins for
  ordering. The script prints every correction it makes.
- **Gaps between flights are left visible, not invented.** Fifteen times the
  arrival airport of one leg is not the departure airport of the next — landed
  at Munich, flew home from Vienna. Those overland moves are not in the log, so
  no line is drawn. `EMIT_SURFACE=1 python3 scripts/build-journeys.py` marks
  them as `surface` segments instead.
- **Ground-leg durations come from a published timetable, not a guess.** The
  seven TER legs around Nice carry the fastest scheduled ride between those
  stations, computed from SNCF's open GTFS feed (`transport.data.gouv.fr`) by
  walking every trip that calls at both stations. The coach up to Èze and the
  two drives into the Dolomites have no recorded time, and say so rather than
  showing an invented one.
- **City names are the common ones**, not OurAirports' administrative
  municipality (Sepang → Kuala Lumpur, Huxi → Penghu). The overrides and their
  reasons are in the script.

## Photos and guestbook (Supabase)

Uploads and the guestbook need a backend; the rest of the site does not. When
the two variables below are missing the app still builds and runs — the
guestbook shows a short notice and the uploader stays hidden.

1. Create a project at supabase.com.
2. Run `supabase/schema.sql` in the SQL editor, then
   `supabase/002-owners-and-journey-comments.sql`. The second one restricts
   photo management to the addresses listed in `site_owners` — add a row per
   person — and gives each journey its own comment thread. It creates the `journey_photos`
   and `guestbook` tables, the `journey-photos` storage bucket, and the
   row-level security that makes a public key safe: anyone may read, anyone may
   sign the guestbook, only signed-in accounts may add or delete photos.
3. Open the project's **Connect** dialog (top of the dashboard), or go to
   **Settings → API Keys**. Take the **Project URL** and either the
   **publishable** key (`sb_publishable_…`) or the legacy **anon** key
   (`eyJ…`) — Supabase issues both and either works here.
4. Locally, put them in `.env.local`:

   ```
   VITE_SUPABASE_URL=https://xxxx.supabase.co
   VITE_SUPABASE_ANON_KEY=eyJ...          # or VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
   ```

5. For the deployed site, add the same two as **repository variables**
   (Settings → Secrets and variables → Actions → Variables) named
   `SUPABASE_URL` and `SUPABASE_ANON_KEY` (or `SUPABASE_PUBLISHABLE_KEY`).

The key is designed to ship in the browser — every Supabase web app contains
one, and Supabase labels the publishable key "safe to expose online". Access is controlled by the policies in `schema.sql`.

### How a photo finds its place in the itinerary

A camera writes `DateTimeOriginal` as a naive local clock. Only newer phones
add `OffsetTimeOriginal`, so most photos carry no time zone at all — and the
same string means different moments depending on where the shutter was pressed.

When the offset is present, the instant is known outright. When it is not, each
stay in the itinerary is tested in *its own* zone: was the traveller in
Vancouver when the camera said 14:03? Every place carries its IANA zone,
resolved from its coordinates, so this needs no guessing about which zone the
phone was set to. The uploader states which method it used for each file.

## Photo credits

Every city photo comes from Wikimedia Commons under CC BY, CC BY-SA, CC0 or
public domain — nothing else was kept. The photographer and licence for each
file is listed in `src/data/image-credits.json` and shown on the Stats page,
because CC BY and CC BY-SA require attribution.

```bash
python3 scripts/fetch-city-images.py
```

Map tiles © [CARTO](https://carto.com/attributions), data ©
[OpenStreetMap](https://www.openstreetmap.org/copyright) contributors.

## Licence

Code: MIT. Photos and map tiles are under their own licences, listed above.
The travel log itself is personal data, included because it is the point.
