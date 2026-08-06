#!/usr/bin/env python3
"""Fetch one representative photo per city from Wikimedia Commons.

Only freely-licensed files are kept, and the author + licence of every file is
written to src/data/image-credits.json so the interface can credit them —
CC BY-SA requires it.
"""
import json
import os
import re
import time
import urllib.parse
import urllib.request
from concurrent.futures import ThreadPoolExecutor

UA = {'User-Agent': 'my-flight-journey/1.0 (personal travel atlas; jimwu@synology.com)'}
HERE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(HERE, '..', 'src', 'data', 'journeys.json')
OUT_DIR = os.path.join(HERE, '..', 'public', 'images', 'cities')
CREDITS = os.path.join(HERE, '..', 'src', 'data', 'image-credits.json')

# Licences we are willing to redistribute in a public repo.
OK_LICENCE = re.compile(
    r'(^cc[ -]?by([ -]sa)?([ -][0-9.]+)?([ -][a-z]{2})?$|^cc0|public domain|^pd|'
    r'^attribution$)',
    re.I,
)

# Where the generic airport city name is ambiguous, name the article directly.
ARTICLE_OVERRIDES = {
    'TPE': 'Taipei',
    'TSA': 'Taipei',
    'MZG': 'Magong',
    'KUL': 'Kuala Lumpur',
    'NRT': 'Tokyo',
    'HND': 'Tokyo',
    'CTS': 'Sapporo',
    'OKA': 'Naha',
    'KIX': 'Osaka',
    'ITM': 'Osaka',
    'JFK': 'New York City',
    'LHR': 'London',
    'CDG': 'Paris',
    'BOD': 'Bordeaux',
    'NCE': 'Nice',
    'VCE': 'Venice',
    'PVG': 'Shanghai',
    'KWE': 'Guiyang',
    'ICN': 'Seoul',
    'BKI': 'Kota Kinabalu',
    'PEN': 'George Town, Penang',
    'OOL': 'Gold Coast, Queensland',
    'YZF': 'Yellowknife',
    'YYC': 'Calgary',
    'YVR': 'Vancouver',
    'SEA': 'Seattle',
    'LAX': 'Los Angeles',
    'MAN': 'Manchester',
    'IST': 'Istanbul',
    'DOH': 'Doha',
    'HKD': 'Hakodate',
    'OKJ': 'Okayama',
    'FUK': 'Fukuoka',
    'MEL': 'Melbourne',
    'BNE': 'Brisbane',
    'PER': 'Perth',
    'MNL': 'Manila',
    'WAW': 'Warsaw',
    'BUD': 'Budapest',
    'HEL': 'Helsinki',
    'MUC': 'Munich',
    'VIE': 'Vienna',
    'DUB': 'Dublin',
    'BKK': 'Bangkok',
    # Country/territory articles lead with a flag, so name a place instead.
    'SIN': 'Downtown Core',
    # Ground-only towns on the Côte d'Azur; Monaco's own article leads with
    # its flag, so name a place inside it.
    'eze': 'Èze',
    'monaco': 'Monte Carlo',
    'menton': 'Menton',
    'cannes': 'Cannes',
    'antibes': 'Antibes',
    'HKG': 'Central, Hong Kong',
    'MFM': 'Macau Peninsula',
}

# A flag, crest or locator map is not a picture of a city.
NOT_A_PHOTO = re.compile(
    r'(flag|coat[ _]of[ _]arms|seal|emblem|locator|location[ _]map|\.svg$)', re.I
)


def api(host, params):
    url = host + '?' + urllib.parse.urlencode(params)
    with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=45) as r:
        return json.load(r)


def strip_html(value):
    return re.sub(r'\s+', ' ', re.sub(r'<[^>]+>', '', value or '')).strip()


def lead_image(title):
    """Commons filename of a Wikipedia article's lead image."""
    d = api('https://en.wikipedia.org/w/api.php', {
        'action': 'query', 'format': 'json', 'titles': title,
        'prop': 'pageimages', 'piprop': 'original',
    })
    page = next(iter(d['query']['pages'].values()))
    src = page.get('original', {}).get('source')
    if not src:
        return None
    # The API appends utm_* tracking params; they are not part of the filename.
    return urllib.parse.unquote(src.split('?')[0].rsplit('/', 1)[-1])


def file_meta(filename):
    """Licence, author and a scaled URL for a Commons file."""
    d = api('https://commons.wikimedia.org/w/api.php', {
        'action': 'query', 'format': 'json', 'titles': 'File:' + filename,
        'prop': 'imageinfo', 'iiprop': 'extmetadata|url', 'iiurlwidth': '1200',
    })
    page = next(iter(d['query']['pages'].values()))
    info = (page.get('imageinfo') or [{}])[0]
    if not info:
        return None
    em = info.get('extmetadata', {})
    return {
        'file': filename,
        'licence': strip_html(em.get('LicenseShortName', {}).get('value')),
        'author': strip_html(em.get('Artist', {}).get('value')) or 'Unknown',
        'credit': strip_html(em.get('Credit', {}).get('value')),
        'url': info.get('thumburl') or info.get('url'),
        'descriptionurl': info.get('descriptionurl'),
    }


def work(place):
    code = place.get('code') or place['id']
    title = ARTICLE_OVERRIDES.get(code, place['name'])
    try:
        filename = lead_image(title)
        if not filename:
            return code, None, f'no lead image for "{title}"'
        if NOT_A_PHOTO.search(filename):
            return code, None, f'lead image is not a photo: {filename}'
        meta = file_meta(filename)
        if not meta or not meta.get('url'):
            return code, None, f'no file info for {filename}'
        if not OK_LICENCE.search(meta['licence'] or ''):
            return code, None, f'licence not redistributable: {meta["licence"]!r}'
        with urllib.request.urlopen(
            urllib.request.Request(meta['url'], headers=UA), timeout=60
        ) as r:
            blob = r.read()
        if len(blob) < 2000:
            return code, None, 'file too small'
        meta['bytes'] = len(blob)
        meta['article'] = title
        return code, (blob, meta), None
    except Exception as exc:  # noqa: BLE001 - report, do not crash the batch
        return code, None, f'{type(exc).__name__}: {exc}'


def main():
    data = json.load(open(os.path.abspath(DATA), encoding='utf-8'))
    # Airports keyed by IATA, plus the ground-only towns keyed by id.
    places = [p for p in data['places'] if p.get('code') or p.get('image') is None]
    os.makedirs(os.path.abspath(OUT_DIR), exist_ok=True)

    credits, failures = {}, []
    with ThreadPoolExecutor(max_workers=5) as ex:
        for code, payload, err in ex.map(work, places):
            if err:
                failures.append((code, err))
                print(f'  {code}  SKIP  {err}')
                continue
            blob, meta = payload
            path = os.path.join(os.path.abspath(OUT_DIR), f'{code}.jpg')
            open(path, 'wb').write(blob)
            credits[code] = {
                'file': meta['file'],
                'author': meta['author'][:160],
                'licence': meta['licence'],
                'source': meta['descriptionurl'],
                'article': meta['article'],
            }
            print(f'  {code}  {meta["licence"]:22s} {meta["bytes"]:>8,}B  {meta["file"][:52]}')
            time.sleep(0.05)

    json.dump(credits, open(os.path.abspath(CREDITS), 'w', encoding='utf-8'),
              ensure_ascii=False, indent=2)
    print(f'\n{len(credits)} images kept, {len(failures)} skipped')
    for code, err in failures:
        print(f'  unresolved: {code} — {err}')


if __name__ == '__main__':
    main()
