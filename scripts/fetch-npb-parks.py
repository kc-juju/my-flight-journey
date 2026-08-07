#!/usr/bin/env python3
"""The twelve NPB ballparks, with where they are.

Japan has no equivalent of the MLB API, so the grounds are named here and
their positions looked up in OpenStreetMap. Written to src/data/npb-parks.json.
"""
import json
import os
import time
import urllib.parse
import urllib.request

UA = {'User-Agent': 'my-flight-journey/1.0 (personal travel atlas; jimwu@synology.com)'}
OUT = os.path.join(os.path.dirname(__file__), '..', 'src', 'data', 'npb-parks.json')

PARKS = [
    ('Meiji Jingu Stadium', 'Tokyo Yakult Swallows', '明治神宮野球場, 新宿区, 東京都'),
    ('Tokyo Dome', 'Yomiuri Giants', '東京ドーム, 文京区, 東京都'),
    ('Hanshin Koshien Stadium', 'Hanshin Tigers', '阪神甲子園球場, 西宮市, 兵庫県'),
    ('Vantelin Dome Nagoya', 'Chunichi Dragons', 'バンテリンドーム ナゴヤ, 名古屋市, 愛知県'),
    ('Mazda Stadium', 'Hiroshima Toyo Carp', 'MAZDA Zoom-Zoom スタジアム広島, 広島市'),
    ('Yokohama Stadium', 'Yokohama DeNA BayStars', '横浜スタジアム, 横浜市, 神奈川県'),
    ('Kyocera Dome Osaka', 'Orix Buffaloes', '京セラドーム大阪, 大阪市, 大阪府'),
    ('ZOZO Marine Stadium', 'Chiba Lotte Marines', 'ZOZOマリンスタジアム, 千葉市, 千葉県'),
    ('Rakuten Mobile Park Miyagi', 'Tohoku Rakuten Golden Eagles', 'Rakuten Mobile SAIKYO Park Miyagi, Sendai'),
    ('Belluna Dome', 'Saitama Seibu Lions', 'ベルーナドーム, 所沢市, 埼玉県'),
    ('Mizuho PayPay Dome', 'Fukuoka SoftBank Hawks', 'みずほPayPayドーム福岡'),
    ('Es Con Field Hokkaido', 'Hokkaido Nippon-Ham Fighters', 'エスコンフィールドHOKKAIDO, 北広島市, 北海道'),
]


def locate(query):
    url = ('https://nominatim.openstreetmap.org/search?format=json&limit=1&'
           + urllib.parse.urlencode({'q': query}))
    rows = json.load(urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=40))
    return (float(rows[0]['lat']), float(rows[0]['lon'])) if rows else None


def main():
    parks = []
    for name, team, query in PARKS:
        point = locate(query)
        if not point:
            print(f'  WARNING: no position for {name}')
            continue
        parks.append({'park': name, 'team': team, 'lat': point[0], 'lon': point[1]})
        print(f'  {name:30s} {point[0]:9.4f} {point[1]:10.4f}')
        time.sleep(1.1)          # Nominatim asks for one call a second
    json.dump(parks, open(os.path.abspath(OUT), 'w', encoding='utf-8'),
              ensure_ascii=False, indent=1)
    print(f'{len(parks)} ballparks written')


if __name__ == '__main__':
    main()
