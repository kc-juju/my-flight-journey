#!/usr/bin/env python3
"""Turn the personal flight log into the atlas's Journey model.

Input   : the merged leg-level dataset (Flighty export + Flightradar24 export,
          joined with OurAirports coordinates and IANA timezones).
Output  : src/data/journeys.json

Grouping rule
-------------
Taiwan (TPE / TSA) is home. A journey opens on the first leg after being home
and closes once a leg lands back home. Legs that do not connect — arriving at
one airport and departing later from another — get an explicit `surface`
segment, because the traveller clearly moved but the log does not say how.

Nothing here is invented: titles, dates, distances and durations are all
derived from the log.
"""
import csv
import io
import json
import datetime as dt
import os
import re
import sys
import unicodedata

SRC = os.environ.get(
    'FLIGHT_DATA',
    '/tmp/claude-0/-synosrc/ec395867-e62f-4b7c-a152-0235c8dfff0a/scratchpad/flight_data.json',
)
OUT = os.path.join(os.path.dirname(__file__), '..', 'src', 'data', 'journeys.json')
FR24_CSV = os.environ.get('FR24_CSV', '/snoopy/flightdiary_2026_08_05_10_50.csv')
# ICAO -> IATA airline designators, resolved from Wikidata P229 and checked
# line by line against the Flightradar24 export. Vendored so the build does
# not depend on anything outside the repo.
# Ground legs the flight log cannot know about, filled in by hand.
# Places that are not airports — towns reached by train, bus or road.
PLACES_EXTRA = os.environ.get(
    'PLACES_EXTRA', os.path.join(os.path.dirname(__file__), 'places-extra.json')
)
OVERLAND = os.environ.get(
    'OVERLAND', os.path.join(os.path.dirname(__file__), 'overland.json')
)
# Hand-written journey notes and per-leg annotations.
JOURNEY_NOTES = os.environ.get(
    'JOURNEY_NOTES', os.path.join(os.path.dirname(__file__), 'journey-notes.json')
)
IATA_MAP = os.environ.get(
    'IATA_MAP', os.path.join(os.path.dirname(__file__), 'airline-iata.json')
)

HOME_AIRPORTS = {'TPE', 'TSA'}
HOME_COUNTRY = 'TW'
# A gap this long without coming home is treated as two separate journeys.
MAX_AWAY_GAP_DAYS = 60
# Emit an explicit `surface` segment where consecutive flights do not connect.
# Off until the overland legs are logged for real — the gaps are still visible
# in the itinerary, we just do not draw a line we cannot describe.
EMIT_SURFACE_SEGMENTS = os.environ.get('EMIT_SURFACE', '0') == '1'

REGION_BY_COUNTRY = {
    'JP': 'japan',
    'KR': 'korea',
    'HK': 'greater-china', 'MO': 'greater-china', 'CN': 'greater-china',
    'SG': 'southeast-asia', 'MY': 'southeast-asia', 'TH': 'southeast-asia',
    'PH': 'southeast-asia',
    'US': 'north-america', 'CA': 'north-america',
    'AU': 'oceania',
    'FI': 'europe', 'PL': 'europe', 'HU': 'europe', 'DE': 'europe', 'AT': 'europe',
    'FR': 'europe', 'GB': 'europe', 'IE': 'europe', 'IT': 'europe', 'TR': 'europe',
    'QA': 'middle-east',
    'TW': 'taiwan',
}

COLLECTIONS = [
    ('japan', 'Japan', 'The most-returned-to country on the map.'),
    ('greater-china', 'Hong Kong, Macau & Mainland', 'The short hops and the long layovers.'),
    ('southeast-asia', 'Southeast Asia', 'Kuala Lumpur, Singapore, Bangkok, Manila.'),
    ('korea', 'Korea', 'Seoul, in winter and in spring.'),
    ('europe', 'Europe', 'Long-haul west, usually with a stop somewhere in between.'),
    ('north-america', 'North America', 'Across the Pacific, and once as far as the Arctic.'),
    ('oceania', 'Oceania', 'The southern hemisphere runs.'),
    ('middle-east', 'Middle East', 'Doha, as a hinge between continents.'),
    ('taiwan', 'Taiwan', 'Songshan to Magong and back.'),
]

COUNTRY_NAMES = {
    'TW': 'Taiwan', 'JP': 'Japan', 'HK': 'Hong Kong', 'MO': 'Macau', 'CN': 'China',
    'KR': 'South Korea', 'SG': 'Singapore', 'MY': 'Malaysia', 'TH': 'Thailand',
    'PH': 'Philippines', 'US': 'United States', 'CA': 'Canada', 'AU': 'Australia',
    'FI': 'Finland', 'PL': 'Poland', 'HU': 'Hungary', 'DE': 'Germany', 'AT': 'Austria',
    'FR': 'France', 'GB': 'United Kingdom', 'IE': 'Ireland', 'IT': 'Italy',
    'TR': 'Türkiye', 'QA': 'Qatar',
}


def load():
    with open(SRC, encoding='utf-8') as fh:
        return json.load(fh)


def fr24_dates():
    """Flightradar24's date per (flight number, origin, destination).

    Flighty and FR24 disagree on the calendar date of overnight departures.
    FR24 matches the physical schedule, so it wins when ordering an itinerary
    — otherwise a journey can come out in an impossible sequence.
    """
    try:
        raw = open(FR24_CSV, encoding='utf-8-sig').read().lstrip('\r\n')
        iata = json.load(open(IATA_MAP, encoding='utf-8'))
    except OSError:
        return {}, {}
    out = {}
    for row in csv.DictReader(io.StringIO(raw)):
        m_from = re.search(r'\(([A-Z0-9]{3})/[A-Z]{4}\)', row['From'])
        m_to = re.search(r'\(([A-Z0-9]{3})/[A-Z]{4}\)', row['To'])
        if not (m_from and m_to):
            continue
        # The same flight number flies the same route year after year, so a
        # key without a date collides. Keep every date and pick the nearest.
        key = (row['Flight number'].strip(), m_from.group(1), m_to.group(1))
        out.setdefault(key, []).append(row['Date'])
    return out, iata


# OurAirports records the municipality an airport sits in, which is often the
# administrative district rather than the city people mean. These are the ones
# that read wrong in a travel atlas.
# Composing these from the official name reads badly, so state them.
LABEL_OVERRIDES = {
    'TPE': 'Taipei Taoyuan',   # official name says "Taiwan Taoyuan"
    'JFK': 'New York JFK',     # "New York John F. Kennedy" is a mouthful
}

CITY_OVERRIDES = {
    'MFM': 'Macau',        # municipality is a parish name
    'KUL': 'Kuala Lumpur', # airport sits in Sepang
    'MZG': 'Penghu',       # airport sits in Huxi, serves Magong
    'TPE': 'Taipei',       # Taipei Taoyuan International
    'NRT': 'Tokyo',        # match HND, which OurAirports already calls Tokyo
    'VCE': 'Venice',       # anglicised for an English interface
}


def clean_city(name, code, country_code):
    """OurAirports municipalities carry administrative baggage. Strip it."""
    if code in CITY_OVERRIDES:
        return CITY_OVERRIDES[code]
    if not name:
        return code
    return name.split('(')[0].split(',')[0].strip() or code


def airport_label(city, official, code):
    """A readable airport name: city plus whatever distinguishes the field.

    OurAirports' official names range from "Dublin Airport" to "Taiwan Taoyuan
    International Airport"; the goal is "Dublin" and "Taipei Taoyuan".
    """
    if code in LABEL_OVERRIDES:
        return LABEL_OVERRIDES[code]
    rest = official
    for word in (' International Airport', ' Airport'):
        rest = rest.replace(word, '')
    rest = rest.replace('International', '').strip()
    if not rest:
        return city
    flat = lambda t: unicodedata.normalize('NFKD', t).encode('ascii', 'ignore').decode().lower()
    if flat(rest) == flat(city) or flat(rest).startswith(flat(city)):
        return rest
    return f'{city} {rest}'


def timezones_for(places):
    """IANA zone per place, so a photo with no EXIF offset can still be read
    in the local time of wherever the traveller actually was."""
    try:
        from timezonefinder import TimezoneFinder
    except ImportError:
        print('  WARNING: timezonefinder not installed — places will carry no timezone')
        return {}
    tf = TimezoneFinder()
    return {
        p['id']: tf.timezone_at(lat=p['lat'], lng=p['lon'])
        for p in places
    }


def load_extra_places():
    try:
        with open(PLACES_EXTRA, encoding='utf-8') as fh:
            return json.load(fh)
    except (OSError, ValueError):
        return []


def load_overland():
    """Hand-recorded ground legs, keyed by the airports they bridge."""
    try:
        with open(OVERLAND, encoding='utf-8') as fh:
            return json.load(fh)
    except (OSError, ValueError):
        return []


def load_notes():
    try:
        with open(JOURNEY_NOTES, encoding='utf-8') as fh:
            return {k: v for k, v in json.load(fh).items() if not k.startswith('_')}
    except (OSError, ValueError):
        return {}


def build():
    data = load()
    airports = {a['c']: a for a in data['airports']}
    airline_names = data.get('airline_names', {})
    fr_dates, iata = fr24_dates()
    overland = load_overland()
    notes = load_notes()

    city_dir = os.path.join(os.path.dirname(__file__), '..', 'public', 'images', 'cities')
    have_image = set()
    have_image_by_id = set()
    if os.path.isdir(city_dir):
        names = {f[:-4] for f in os.listdir(city_dir) if f.endswith('.jpg')}
        have_image = {n for n in names if n.isupper()}
        have_image_by_id = {n for n in names if not n.isupper()}

    places = [
        {
            'id': code.lower(),
            'name': clean_city(a.get('city'), code, a['cty']),
            'code': code,
            'country': COUNTRY_NAMES.get(a['cty'], a['cty']),
            'countryCode': a['cty'],
            'airportName': airport_label(
                clean_city(a.get('city'), code, a['cty']), a['name'], code
            ),
            'lat': a['lat'],
            'lon': a['lon'],
            **({'home': True} if code in HOME_AIRPORTS else {}),
            **({'image': f'/images/cities/{code}.jpg'} if code in have_image else {}),
        }
        for code, a in sorted(airports.items())
    ]
    # Towns reached on the ground sit alongside the airports. They have no
    # IATA code, so the itinerary refers to them by id.
    for extra in load_extra_places():
        if any(p['id'] == extra['id'] for p in places):
            continue
        places.append(dict(extra))
    # Ground-only towns keep their photo under their id.
    for place in places:
        if place.get('image'):
            continue
        if place['id'] in have_image_by_id:
            place['image'] = f"/images/cities/{place['id']}.jpg"
    places.sort(key=lambda p: (p.get('code') or '~', p['name']))

    place_id = {p['code']: p['id'] for p in places if p.get('code')}
    place_id.update({p['id']: p['id'] for p in places})

    zones = timezones_for(places)
    missing_zone = []
    for p in places:
        zone = zones.get(p['id'])
        if zone:
            p['timezone'] = zone
        else:
            missing_zone.append(p['code'])
    if missing_zone:
        print(f'  WARNING: no timezone for {missing_zone}')

    legs = [f for f in data['flights'] if not f['canceled']]

    # Order by the most reliable date available, then by local departure clock.
    corrected = []
    for leg in legs:
        key = (f"{iata.get(leg['al'], leg['al'])}{leg['fl']}", leg['o'], leg['d'])
        leg['_orderDate'] = leg['date']
        own = dt.date.fromisoformat(leg['date'])
        candidates = fr_dates.get(key) or []
        near = [
            d for d in candidates
            if abs((dt.date.fromisoformat(d) - own).days) <= 2
        ]
        if not near:
            continue
        best = min(near, key=lambda d: abs((dt.date.fromisoformat(d) - own).days))
        if best != leg['date']:
            leg['_orderDate'] = best
            corrected.append(f"{leg['date']}→{best} {leg['o']}-{leg['d']} {key[0]}")
    for note in corrected:
        print(f'  re-dated from the Flightradar24 record: {note}')
    legs.sort(key=lambda f: (f['_orderDate'], f.get('dep_local') or ''))

    # ---- group legs into journeys -------------------------------------
    groups = []
    current = None
    for leg in legs:
        if current is None:
            current = [leg]
            continue
        prev = current[-1]
        gap = (dt.date.fromisoformat(leg['_orderDate'])
               - dt.date.fromisoformat(prev['_orderDate'])).days
        home_now = prev['d'] in HOME_AIRPORTS
        if (home_now and gap >= 1) or gap > MAX_AWAY_GAP_DAYS:
            groups.append(current)
            current = [leg]
        else:
            current.append(leg)
    if current:
        groups.append(current)

    journeys = []
    for group in groups:
        first, last = group[0], group[-1]
        segments = []

        for i, leg in enumerate(group):
            # A gap between the previous arrival and this departure means the
            # traveller moved overland. Record it as such rather than pretend
            # the flights connect.
            if EMIT_SURFACE_SEGMENTS and i and group[i - 1]['d'] != leg['o']:
                prev = group[i - 1]
                segments.append({
                    'id': f"{prev['date']}-{prev['d']}-{leg['o']}-surface",
                    'mode': 'surface',
                    'fromPlaceId': place_id[prev['d']],
                    'toPlaceId': place_id[leg['o']],
                    'note': 'Overland — the flight log does not record how',
                })

            # A hand-recorded ground leg that bridges this gap goes in first.
            if i:
                prev_code = group[i - 1]['d']
                for entry in overland:
                    if entry.get('_used'):
                        continue
                    if entry['from'] != prev_code or entry['to'] != leg['o']:
                        continue
                    if not (group[i - 1]['_orderDate'] <= entry['date'] <= leg['_orderDate']):
                        continue
                    entry['_used'] = True
                    ground = {
                        'id': f"{entry['date']}-{entry['from']}{entry['to']}-{entry['mode']}",
                        'mode': entry['mode'],
                        'fromPlaceId': place_id[entry['from']],
                        'toPlaceId': place_id[entry['to']],
                    }
                    for key in ('operator', 'reference', 'vehicle', 'note'):
                        if entry.get(key):
                            ground[key] = entry[key]
                    # Clock times are optional — the date alone is honest when
                    # that is all that was remembered.
                    if entry.get('departure'):
                        ground['departure'] = f"{entry['date']}T{entry['departure']}"
                    if entry.get('arrival'):
                        arr_date = entry.get('arrivalDate', entry['date'])
                        ground['arrival'] = f"{arr_date}T{entry['arrival']}"
                    if entry.get('durationMinutes'):
                        ground['durationMinutes'] = entry['durationMinutes']
                    segments.append(ground)
                    break

            arrival = None
            if leg.get('arr_local'):
                arr_date = dt.date.fromisoformat(leg['date']) + dt.timedelta(
                    days=leg.get('arr_day') or 0
                )
                arrival = f"{arr_date.isoformat()}T{leg['arr_local']}"

            seg = {
                'id': f"{leg['date']}-{leg['al']}{leg['fl']}-{leg['o']}{leg['d']}",
                'mode': 'flight',
                'fromPlaceId': place_id[leg['o']],
                'toPlaceId': place_id[leg['d']],
                'operator': airline_names.get(leg['al'], leg['al']),
                # Show the two-letter code people see on a ticket: UO117, not
                # HKE117. Falls back to ICAO if an airline has no IATA code.
                'reference': f"{iata.get(leg['al']) or leg['al']}{leg['fl']}",
            }
            if leg.get('dep_local'):
                seg['departure'] = f"{leg['date']}T{leg['dep_local']}"
            if arrival:
                seg['arrival'] = arrival
            if leg.get('dur'):
                seg['durationMinutes'] = leg['dur']
            if leg.get('ac'):
                seg['vehicle'] = leg['ac']
            if leg.get('reg'):
                seg['registration'] = leg['reg']
            if leg.get('cab'):
                seg['cabin'] = leg['cab'].replace('_', ' ').title()
            segments.append(seg)

        # ---- derived identity -----------------------------------------
        visited = []
        for leg in group:
            for code in (leg['o'], leg['d']):
                cc = airports[code]['cty']
                if cc not in visited:
                    visited.append(cc)
        away = [c for c in visited if c != HOME_COUNTRY]

        home = airports['TPE']

        def far(code):
            a = airports[code]
            return (a['lat'] - home['lat']) ** 2 + (a['lon'] - home['lon']) ** 2

        farthest = max((leg['d'] for leg in group), key=far)
        region = REGION_BY_COUNTRY.get(airports[farthest]['cty'], 'other')

        # A trip that touches Hong Kong and Korea belongs in both collections.
        # Home is dropped unless the journey never left it.
        regions = []
        for code in visited:
            r = REGION_BY_COUNTRY.get(code)
            if r and r not in regions:
                regions.append(r)
        home_region = REGION_BY_COUNTRY.get(HOME_COUNTRY)
        if len(regions) > 1 and home_region in regions:
            regions.remove(home_region)
        if region in regions:
            regions.remove(region)
        regions.insert(0, region)

        if away:
            title = ' · '.join(COUNTRY_NAMES.get(c, c) for c in away[:3])
            if len(away) > 3:
                title += f' +{len(away) - 3}'
        else:
            title = clean_city(
                airports[farthest].get('city'), farthest, airports[farthest]['cty']
            )

        stops = []
        for seg in segments:
            for pid in (seg['fromPlaceId'], seg['toPlaceId']):
                if not stops or stops[-1]['placeId'] != pid:
                    stops.append({'placeId': pid})

        hero = f'/images/cities/{farthest}.jpg' if farthest in have_image else None

        journeys.append({
            'id': f"{first['date']}-{farthest.lower()}",
            'slug': f"{first['date']}-{'-'.join(c.lower() for c in away[:2]) or 'taiwan'}",
            'title': title,
            'subtitle': ' → '.join([group[0]['o']] + [leg['d'] for leg in group]),
            'startDate': first['date'],
            'endDate': last['date'],
            'status': 'planned' if any(leg['future'] for leg in group) else 'completed',
            'collectionId': region,
            'collectionIds': regions,
            **({'heroImage': hero, 'thumbnail': hero} if hero else {}),
            'highlights': [],
            'stops': stops,
            'segments': segments,
        })

    used = {c for j in journeys for c in j['collectionIds']}
    cover = {}
    for j in journeys:
        if j.get('heroImage'):
            cover.setdefault(j['collectionId'], j['heroImage'])
    collections = [
        {
            'id': cid, 'title': title, 'blurb': blurb, 'icon': 'travel_explore',
            **({'image': cover[cid]} if cid in cover else {}),
        }
        for cid, title, blurb in COLLECTIONS
        if cid in used
    ]

    # slugs must be unique
    seen = {}
    for j in journeys:
        base = j['slug']
        n = seen.get(base, 0)
        seen[base] = n + 1
        if n:
            j['slug'] = f'{base}-{n + 1}'

    # Attach the hand-written notes now that slugs are final.
    applied = 0
    for journey in journeys:
        entry = notes.get(journey['slug']) or {}
        if entry:
            applied += 1
        if entry.get('notes'):
            journey['notes'] = entry['notes']
        if entry.get('highlights'):
            journey['highlights'] = entry['highlights']
        for ann in entry.get('segments', []):
            for seg in journey['segments']:
                if seg.get('dropped'):
                    continue
                if (place_id.get(ann['from']) == seg['fromPlaceId']
                        and place_id.get(ann['to']) == seg['toPlaceId']):
                    seg['note'] = ' • '.join(filter(None, [seg.get('note'), ann['note']]))
                    break

        # "Farthest from home" is a decent guess at what a trip was about, but
        # not always right — a Hong Kong week with a Seoul weekend reads as
        # Korea. journey-notes.json can say otherwise.
        if entry.get('collection'):
            primary = entry['collection']
            journey['collectionId'] = primary
            ids = [c for c in journey['collectionIds'] if c != primary]
            journey['collectionIds'] = [primary, *ids]

        for leg in [e for e in overland if e.get('journey') == journey['slug']]:
            leg['_used'] = True
            ground = {
                'id': f"{leg['date']}-{leg['from']}-{leg['to']}-{leg['mode']}",
                'mode': leg['mode'],
                'fromPlaceId': place_id[leg['from']],
                'toPlaceId': place_id[leg['to']],
                'departure': (f"{leg['date']}T{leg['departure']}"
                              if leg.get('departure') else leg['date']),
            }
            if leg.get('arrival'):
                ground['arrival'] = f"{leg.get('arrivalDate', leg['date'])}T{leg['arrival']}"
            for key in ('operator', 'reference', 'vehicle', 'note'):
                if leg.get(key):
                    ground[key] = leg[key]
            if leg.get('durationMinutes'):
                ground['durationMinutes'] = leg['durationMinutes']

            at = len(journey['segments'])
            last = ''
            for idx, existing in enumerate(journey['segments']):
                when = (existing.get('departure') or '')[:10] or last
                last = when or last
                if when and when > ground['departure'][:10]:
                    at = idx
                    break
            journey['segments'].insert(at, ground)

        for drop in entry.get('dropped', []):
            seg = {
                'id': f"{drop['date']}-{drop['from']}{drop['to']}-dropped",
                'mode': drop.get('mode', 'flight'),
                'fromPlaceId': place_id[drop['from']],
                'toPlaceId': place_id[drop['to']],
                # Date only unless a clock time was actually recorded — a
                # placeholder 00:00 would read as a real departure.
                'departure': (f"{drop['date']}T{drop['departure']}"
                              if drop.get('departure') else drop['date']),
                'dropped': True,
            }
            for key in ('operator', 'reference', 'vehicle', 'cabin', 'note'):
                if drop.get(key):
                    seg[key] = drop[key]

            # The list is already chronological; undated legs (a coach with no
            # times) inherit the date of the leg before them.
            at = len(journey['segments'])
            last = ''
            for idx, existing in enumerate(journey['segments']):
                when = (existing.get('departure') or '')[:10] or last
                last = when or last
                if when and when > drop['date']:
                    at = idx
                    break
            journey['segments'].insert(at, seg)

    for slug in notes:
        if not any(j['slug'] == slug for j in journeys):
            print(f'  WARNING: note for unknown journey "{slug}"')
    print(f'  journeys annotated: {applied}')

    out = {'places': places, 'collections': collections, 'journeys': journeys}
    with open(os.path.abspath(OUT), 'w', encoding='utf-8') as fh:
        json.dump(out, fh, ensure_ascii=False, indent=2)

    unused = [e for e in overland if not e.get('_used')]
    for e in unused:
        print(f"  WARNING: overland {e['from']}->{e['to']} on {e['date']} matched no gap")
    ground_n = sum(1 for j in journeys for s in j['segments']
                   if s['mode'] not in ('flight', 'surface'))
    print(f'  ground legs merged: {ground_n}')
    surf = sum(1 for j in journeys for s in j['segments'] if s['mode'] == 'surface')
    print(f'{len(legs)} legs -> {len(journeys)} journeys, '
          f'{sum(len(j["segments"]) for j in journeys)} segments '
          f'({surf} overland), {len(places)} places, {len(collections)} collections')
    return out


if __name__ == '__main__':
    sys.exit(0 if build() else 1)
