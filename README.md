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
- **City names are the common ones**, not OurAirports' administrative
  municipality (Sepang → Kuala Lumpur, Huxi → Penghu). The overrides and their
  reasons are in the script.

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
