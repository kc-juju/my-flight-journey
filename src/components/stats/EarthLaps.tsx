/** The equator, in kilometres. Every lap below is measured against it. */
export const EARTH_CIRCUMFERENCE_KM = 40_075;

/**
 * Distance travelled, drawn as laps of the planet.
 *
 * A percentage of the way to the moon is a number you have to trust; a row of
 * rings is one you can count. Whole laps are filled, the one in progress is
 * drawn as far as it has got, and the ring after it stays empty so there is
 * always something still to run.
 */
export function EarthLaps({ km }: { km: number }) {
  const laps = km / EARTH_CIRCUMFERENCE_KM;
  return (
    <p className="mt-stack-sm font-body-md text-sm text-on-surface-variant">
      <span className="font-stat-display text-[20px] text-on-surface">{laps.toFixed(1)}</span>
      {' times around the equator ('}
      {formatKm(EARTH_CIRCUMFERENCE_KM)} km a lap). Distances are great-circle, not the
      track actually flown.
    </p>
  );
}

function formatKm(n: number) {
  return n.toLocaleString('en-GB');
}
