#!/usr/bin/env python3
"""Turn a Flighty CSV export into the intermediate the build reads.

The atlas is built from `flight_data.json`, which used to be produced outside
this repository and then vanished with the machine that held it — leaving a
site that could not be rebuilt from its own sources. This script closes that
gap: given a Flighty export, it writes the intermediate, so the whole chain
from export to published page lives here.

Two things it does not invent:

* Airport coordinates and names come from the atlas already built, not from
  any list typed out here. An airport the atlas has never seen must be added
  to `airports-extra.json` with a real source.
* Airline names likewise are recovered by matching each row against the leg
  it produced last time. An airline flown for the first time keeps its ICAO
  code until the atlas learns better.

Usage:
    python3 scripts/flighty-to-flightdata.py FlightyExport.csv [-o out.json]
"""

import argparse
import csv
import datetime as dt
import json
import os
import sys
from zoneinfo import ZoneInfo

HERE = os.path.dirname(os.path.abspath(__file__))
ATLAS = os.path.join(HERE, '..', 'src', 'data', 'journeys.json')
EXTRA = os.path.join(HERE, 'airports-extra.json')
REGISTRATIONS = os.path.join(HERE, 'registrations.json')
REDATES = os.path.join(HERE, 'redates.json')
EXTRA_FLIGHTS = os.path.join(HERE, 'extra-flights.json')
IATA_MAP = os.path.join(HERE, 'airline-iata.json')


def parse_stamp(value):
    """Flighty writes '2026-08-22T16:15', and sometimes seconds as well."""
    value = (value or '').strip()
    if not value:
        return None
    for shape in ('%Y-%m-%dT%H:%M:%S', '%Y-%m-%dT%H:%M'):
        try:
            return dt.datetime.strptime(value, shape)
        except ValueError:
            continue
    return None


def minutes_between(a, b):
    return None if a is None or b is None else round((b - a).total_seconds() / 60)


def load_atlas():
    with open(ATLAS, encoding='utf-8') as fh:
        return json.load(fh)


def airports_from(atlas):
    """Every airport the atlas already knows, in the shape the build wants."""
    out = {}
    for place in atlas['places']:
        code = place.get('code')
        if not code:
            continue
        out[code] = {
            'c': code,
            'city': place['name'],
            'cty': place['countryCode'],
            'name': place.get('airportName') or place['name'],
            'lat': place['lat'],
            'lon': place['lon'],
            'tz': place.get('timezone'),
        }
    if os.path.exists(EXTRA):
        with open(EXTRA, encoding='utf-8') as fh:
            for airport in json.load(fh):
                out[airport['c']] = airport
    return out


def airline_names_from(atlas):
    """ICAO -> the name the atlas prints, recovered from the legs themselves.

    The export carries ICAO designators and the atlas carries display names;
    neither carries both. The bridge is the leg: same date, same pair of
    airports, so whatever the atlas called that operator is what this ICAO
    means.
    """
    by_leg = {}
    codes = {p['id']: p.get('code') for p in atlas['places']}
    for journey in atlas['journeys']:
        for segment in journey['segments']:
            if segment.get('mode') != 'flight' or not segment.get('operator'):
                continue
            date = (segment.get('departure') or '')[:10]
            key = (date, codes.get(segment['fromPlaceId']), codes.get(segment['toPlaceId']))
            by_leg[key] = segment['operator']
    return by_leg


def registrations_from():
    """Tail numbers already known, keyed by the leg's id.

    A Flighty export does not always carry the registration, and an export
    that has forgotten one is not evidence that the aircraft had none.

    These are kept in their own file rather than read back out of the last
    build: the build overwrites that file, so reading it here would mean
    every rebuild inherited whatever the previous one happened to lose.
    """
    if not os.path.exists(REGISTRATIONS):
        return {}
    with open(REGISTRATIONS, encoding='utf-8') as fh:
        return json.load(fh)


def load_json(path, strip_comments=False):
    if not os.path.exists(path):
        return {}
    with open(path, encoding='utf-8') as fh:
        data = json.load(fh)
    return {k: v for k, v in data.items() if not k.startswith('_')} if strip_comments else data


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('csv')
    ap.add_argument('-o', '--out', default=os.environ.get('FLIGHT_DATA'))
    args = ap.parse_args()
    if not args.out:
        ap.error('give -o, or set FLIGHT_DATA')

    atlas = load_atlas()
    airports = airports_from(atlas)
    leg_operator = airline_names_from(atlas)
    known_reg = registrations_from()
    redates = load_json(REDATES, strip_comments=True)
    iata = load_json(IATA_MAP)

    with open(args.csv, encoding='utf-8-sig') as fh:
        rows = list(csv.DictReader(fh))

    today = dt.date.today()
    flights = []
    airline_names = {}
    unknown = set()

    for row in rows:
        origin, dest = row['From'].strip(), row['To'].strip()
        if not origin or not dest:
            continue
        for code in (origin, dest):
            if code not in airports:
                unknown.add(code)

        sched_dep = parse_stamp(row['Gate Departure (Scheduled)'])
        sched_arr = parse_stamp(row['Gate Arrival (Scheduled)'])
        actual_dep = parse_stamp(row['Gate Departure (Actual)'])
        actual_arr = parse_stamp(row['Gate Arrival (Actual)'])

        date = (sched_dep.date().isoformat() if sched_dep else row['Date'].strip())
        icao = row['Airline'].strip()

        # A date the log gets wrong is a property of the export, so it is
        # corrected here — before the leg's id is formed from it, and with it
        # everything keyed by that id.
        fix = redates.get(
            f"{date} {iata.get(icao, icao)}{row['Flight'].strip()} {origin} {dest}"
        )
        if fix:
            date = fix['date']

        # What the card shows is what happened, not what was planned: a flight
        # that pushed back at 06:32 left at 06:32. The schedule survives as
        # the delay, which is the only thing it is needed for.
        dep_local, arr_local = actual_dep or sched_dep, actual_arr or sched_arr

        # Block time has to be computed in real time, not on the two clock
        # faces: Taipei to Seattle would otherwise come out negative.
        duration = None
        tz_from, tz_to = airports.get(origin, {}).get('tz'), airports.get(dest, {}).get('tz')
        if dep_local and arr_local and tz_from and tz_to:
            duration = minutes_between(
                dep_local.replace(tzinfo=ZoneInfo(tz_from)),
                arr_local.replace(tzinfo=ZoneInfo(tz_to)),
            )
            if duration is not None and duration <= 0:
                duration = None

        name = leg_operator.get((date, origin, dest))
        if name:
            airline_names[icao] = name

        flights.append({
            'date': date,
            'al': icao,
            'fl': row['Flight'].strip(),
            'o': origin,
            'd': dest,
            'dep_local': dep_local.strftime('%H:%M') if dep_local else None,
            'arr_local': arr_local.strftime('%H:%M') if arr_local else None,
            'arr_day': (arr_local.date() - dep_local.date()).days
            if dep_local and arr_local else 0,
            'dep': minutes_between(sched_dep, actual_dep),
            'arr': minutes_between(sched_arr, actual_arr),
            'dur': duration,
            'ac': row['Aircraft Type Name'].strip() or None,
            'reg': row['Tail Number'].strip() or known_reg.get(
                f"{date}-{icao}{row['Flight'].strip()}-{origin}{dest}"),
            'cab': row['Cabin Class'].strip() or None,
            'canceled': row['Canceled'].strip().lower() == 'true',
            # A booked flight is a plan; the site says so on the card.
            'future': dt.date.fromisoformat(date) > today,
        })

    # Legs written by hand, appended as though the export had carried them.
    for extra in load_json(EXTRA_FLIGHTS, strip_comments=True).get('flights', []):
        number = extra['flight'].strip()
        code = ''.join(c for c in number if not c.isdigit())
        digits = number[len(code):]
        for airport in (extra['from'], extra['to']):
            if airport not in airports:
                unknown.add(airport)
        dep = parse_stamp(extra.get('departure'))
        arr = parse_stamp(extra.get('arrival'))
        duration = None
        tz_from = airports.get(extra['from'], {}).get('tz')
        tz_to = airports.get(extra['to'], {}).get('tz')
        if dep and arr and tz_from and tz_to:
            duration = minutes_between(
                dep.replace(tzinfo=ZoneInfo(tz_from)), arr.replace(tzinfo=ZoneInfo(tz_to))
            )
            if duration is not None and duration <= 0:
                duration = None
        if extra.get('airline'):
            airline_names[code] = extra['airline']
        date = extra.get('date') or (dep.date().isoformat() if dep else None)
        flights.append({
            'date': date,
            'al': code,
            'fl': digits,
            'o': extra['from'],
            'd': extra['to'],
            'dep_local': dep.strftime('%H:%M') if dep else None,
            'arr_local': arr.strftime('%H:%M') if arr else None,
            'arr_day': (arr.date() - dep.date()).days if dep and arr else 0,
            'dep': None,
            'arr': None,
            'dur': duration,
            'ac': extra.get('aircraft'),
            'reg': extra.get('registration'),
            'cab': extra.get('cabin'),
            'canceled': bool(extra.get('canceled')),
            'future': dt.date.fromisoformat(date) > today,
        })

    if unknown:
        # The build would otherwise fail deep inside, looking up a place id
        # that was never made. Say what is missing, and where to put it.
        print(
            f'  ERROR: no coordinates for {", ".join(sorted(unknown))}.\n'
            f'  Add each to scripts/{os.path.basename(EXTRA)} with a real source'
            f' — {{"c": "SGN", "city": "Ho Chi Minh City", "cty": "VN",'
            f' "name": "Tan Son Nhat International", "lat": …, "lon": …,'
            f' "tz": "Asia/Ho_Chi_Minh", "source": "…"}}',
            file=sys.stderr,
        )
        sys.exit(1)

    payload = {
        'airports': sorted(airports.values(), key=lambda a: a['c']),
        'airline_names': airline_names,
        'flights': flights,
    }
    with open(args.out, 'w', encoding='utf-8') as fh:
        json.dump(payload, fh, ensure_ascii=False, indent=1)

    print(f'  {len(flights)} flights, {len(airports)} airports,'
          f' {len(airline_names)} airlines → {args.out}')


if __name__ == '__main__':
    main()
