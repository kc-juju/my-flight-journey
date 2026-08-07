#!/usr/bin/env python3
"""The thirty Major League ballparks, with where they are.

Straight from the league's own API, so the list stays right when a team
moves. Written to src/data/mlb-parks.json for the map on the stats page.
"""
import json
import os
import urllib.request

URL = ('https://statsapi.mlb.com/api/v1/teams'
       '?sportId=1&season=2025&hydrate=venue(location)')
OUT = os.path.join(os.path.dirname(__file__), '..', 'src', 'data', 'mlb-parks.json')


def main():
    data = json.load(urllib.request.urlopen(URL, timeout=60))
    parks = []
    for team in data['teams']:
        venue = team.get('venue') or {}
        point = (venue.get('location') or {}).get('defaultCoordinates') or {}
        if not point.get('latitude'):
            print(f'  WARNING: no coordinates for {venue.get("name")}')
            continue
        parks.append({
            'park': venue['name'],
            'team': team['name'],
            'lat': point['latitude'],
            'lon': point['longitude'],
        })
    parks.sort(key=lambda p: p['park'])
    json.dump(parks, open(os.path.abspath(OUT), 'w', encoding='utf-8'),
              ensure_ascii=False, indent=1)
    print(f'{len(parks)} ballparks written')


if __name__ == '__main__':
    main()
