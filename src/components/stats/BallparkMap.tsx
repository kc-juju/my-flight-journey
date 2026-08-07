import { useMemo } from 'react';
import { CircleMarker, MapContainer, TileLayer, Tooltip } from 'react-leaflet';
import type { Place } from '../../types/journey';

const TILE_URL = 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png';
const TILE_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>';

export interface Park {
  park: string;
  team: string;
  lat: number;
  lon: number;
}

/**
 * Same ground, different name: the atlas says Koshien and the league says
 * Hanshin Koshien Stadium. Position settles it — two kilometres is closer
 * than any two ballparks come to each other.
 */
const NEAR_KM = 2;

function distanceKm(a: { lat: number; lon: number }, b: { lat: number; lon: number }) {
  const R = 6371;
  const rad = (x: number) => (x * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLon = rad(b.lon - a.lon);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/**
 * All thirty Major League grounds, with the ones stood in marked.
 *
 * The list comes from the league's own API rather than being typed out, so a
 * team that moves takes its ballpark with it. Which ones count as visited is
 * decided by the games in the atlas, not by a second list kept in step by
 * hand.
 */
export function BallparkMap({
  title,
  parks,
  visited,
  center,
  zoom,
}: {
  title: string;
  parks: Park[];
  visited: Place[];
  center: [number, number];
  zoom: number;
}) {
  const all = parks;
  const been = useMemo(
    () =>
      new Set(
        all
          .filter((park) => visited.some((place) => distanceKm(park, place) < NEAR_KM))
          .map((park) => park.park),
      ),
    [all, visited],
  );

  return (
    <div className="flex flex-col gap-stack-sm">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <span className="font-label-caps text-label-caps uppercase tracking-widest text-on-surface-variant">
          {title}
        </span>
        <span className="font-label-caps text-[11px] uppercase tracking-widest text-on-surface-variant">
          <span className="font-stat-display text-[18px] text-on-surface">{been.size}</span> of{' '}
          {all.length}
        </span>
      </div>

      <div className="h-[340px] w-full overflow-hidden rounded-xl border border-outline-variant/40">
        <MapContainer
          center={center}
          zoom={zoom}
          minZoom={2}
          scrollWheelZoom={false}
          className="h-full w-full"
        >
          <TileLayer
            url={TILE_URL}
            attribution={TILE_ATTRIBUTION}
            subdomains="abcd"
            className="atlas-tiles"
          />
          {all.map((park) => {
            const seen = been.has(park.park);
            return (
              <CircleMarker
                key={park.park}
                center={[park.lat, park.lon]}
                radius={seen ? 7 : 4}
                pathOptions={{
                  color: seen ? '#b8860b' : '#9a9a94',
                  weight: seen ? 2 : 1,
                  fillColor: seen ? '#e0a63a' : '#ffffff',
                  fillOpacity: seen ? 0.95 : 0.55,
                }}
              >
                <Tooltip direction="top" offset={[0, -6]}>
                  <span className="font-body-md text-xs">
                    {park.park} — {park.team}
                    {seen ? ' · been' : ''}
                  </span>
                </Tooltip>
              </CircleMarker>
            );
          })}
        </MapContainer>
      </div>

      <p className="font-body-md text-xs text-on-surface-variant">
        Filled marks are grounds a game was watched at. Ballparks and their
        positions come from the league's own record.
      </p>
    </div>
  );
}
