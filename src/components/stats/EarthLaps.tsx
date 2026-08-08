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
  const whole = Math.floor(laps);
  const part = laps - whole;
  const rings = whole + 1;

  const R = 13;
  const CIRCUMFERENCE = 2 * Math.PI * R;

  return (
    <div className="mt-stack-md flex w-full flex-col gap-stack-sm">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-3">
        {Array.from({ length: rings }, (_, i) => {
          const filled = i < whole ? 1 : part;
          return (
            <svg
              key={i}
              viewBox="0 0 32 32"
              className="h-8 w-8 shrink-0 -rotate-90"
              aria-hidden
            >
              <circle
                cx="16"
                cy="16"
                r={R}
                fill="none"
                strokeWidth="3"
                className="stroke-surface-container"
              />
              <circle
                cx="16"
                cy="16"
                r={R}
                fill="none"
                strokeWidth="3"
                strokeLinecap="round"
                strokeDasharray={`${CIRCUMFERENCE * filled} ${CIRCUMFERENCE}`}
                className="stroke-primary"
              />
            </svg>
          );
        })}

        <span className="ml-1 flex items-baseline gap-2">
          <span className="font-stat-display text-[28px] leading-none text-on-surface">
            {laps.toFixed(1)}
          </span>
          <span className="font-label-caps text-[10px] uppercase tracking-widest text-on-surface-variant">
            times around the Earth
          </span>
        </span>
      </div>

      <p className="font-body-md text-sm text-on-surface-variant">
        One ring is a lap of the equator ({formatKm(EARTH_CIRCUMFERENCE_KM)} km). Distances
        are great-circle, not the track actually flown.
      </p>
    </div>
  );
}

function formatKm(n: number) {
  return n.toLocaleString('en-GB');
}
