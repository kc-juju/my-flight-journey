import type { Place } from '../types/journey';

export type LatLng = [number, number];

const EARTH_RADIUS_KM = 6371.0088;
const toRad = (deg: number) => (deg * Math.PI) / 180;
const toDeg = (rad: number) => (rad * 180) / Math.PI;

/** Great-circle distance in kilometres. */
export function distanceKm(a: Place, b: Place): number {
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(h));
}

/**
 * Sample the great circle between two places.
 *
 * Longitude is deliberately allowed to run past ±180 so a Pacific crossing
 * stays one unbroken line, continuing into the adjacent world copy where
 * Leaflet repeats the tiles. Splitting at the antimeridian instead leaves a
 * visible gap mid-ocean.
 *
 * Returns an array of runs to keep the caller's shape stable.
 */
export function greatCircle(a: Place, b: Place, samples = 64): LatLng[][] {
  const lat1 = toRad(a.lat);
  const lon1 = toRad(a.lon);
  const lat2 = toRad(b.lat);
  const lon2 = toRad(b.lon);

  const d =
    2 *
    Math.asin(
      Math.sqrt(
        Math.sin((lat2 - lat1) / 2) ** 2 +
          Math.cos(lat1) * Math.cos(lat2) * Math.sin((lon2 - lon1) / 2) ** 2,
      ),
    );

  if (d === 0) return [];

  const run: LatLng[] = [];
  let shift = 0;
  let previousLon: number | null = null;

  for (let i = 0; i <= samples; i += 1) {
    const f = i / samples;
    const A = Math.sin((1 - f) * d) / Math.sin(d);
    const B = Math.sin(f * d) / Math.sin(d);
    const x = A * Math.cos(lat1) * Math.cos(lon1) + B * Math.cos(lat2) * Math.cos(lon2);
    const y = A * Math.cos(lat1) * Math.sin(lon1) + B * Math.cos(lat2) * Math.sin(lon2);
    const z = A * Math.sin(lat1) + B * Math.sin(lat2);

    const lat = toDeg(Math.atan2(z, Math.hypot(x, y)));
    const lon = toDeg(Math.atan2(y, x));

    if (previousLon !== null) {
      // Compare RAW longitudes. Folding `shift` into this test makes the
      // accumulated offset cancel itself out on the sample after a crossing,
      // which snaps the line back across the whole map.
      const delta = lon - previousLon;
      if (delta > 180) shift -= 360;
      else if (delta < -180) shift += 360;
    }
    previousLon = lon;
    run.push([lat, lon + shift]);
  }

  return run.length > 1 ? [run] : [];
}

/** Flatten a set of polylines back into points. */
export const flatten = (lines: LatLng[][]): LatLng[] => lines.flat();

/** Bounding box of a set of points, padded so markers are not flush to the edge. */
export function boundsOf(points: LatLng[], padDegrees = 4): [LatLng, LatLng] | null {
  if (!points.length) return null;
  let minLat = Infinity;
  let maxLat = -Infinity;
  let minLon = Infinity;
  let maxLon = -Infinity;
  for (const [lat, lon] of points) {
    minLat = Math.min(minLat, lat);
    maxLat = Math.max(maxLat, lat);
    minLon = Math.min(minLon, lon);
    maxLon = Math.max(maxLon, lon);
  }
  return [
    [minLat - padDegrees, minLon - padDegrees],
    [maxLat + padDegrees, maxLon + padDegrees],
  ];
}
