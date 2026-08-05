import { Fragment, useMemo } from 'react';
import { CircleMarker, Polyline, Tooltip } from 'react-leaflet';
import type { Journey, Place } from '../../types/journey';
import { greatCircle, type LatLng } from '../../lib/geo';
import { MODE_COLOR } from '../../lib/format';

export interface RouteHandlers {
  onHover?: (journey: Journey | null, event?: { clientX: number; clientY: number }) => void;
  onSelect?: (journey: Journey) => void;
}

interface JourneyRoutesProps extends RouteHandlers {
  journeys: Journey[];
  placesById: Map<string, Place>;
  /** Journey currently emphasised; everything else dims. */
  activeId?: string | null;
  /** Show the node markers as well as the lines. */
  showNodes?: boolean;
}

/**
 * Draws every segment of every journey as a great-circle polyline.
 * Kept free of map state so it can be reused inside any <MapContainer>.
 */
export function JourneyRoutes({
  journeys,
  placesById,
  activeId = null,
  showNodes = true,
  onHover,
  onSelect,
}: JourneyRoutesProps) {
  const drawn = useMemo(
    () =>
      journeys.map((journey) => {
        const lines = journey.segments
          .map((segment) => {
            const from = placesById.get(segment.fromPlaceId);
            const to = placesById.get(segment.toPlaceId);
            if (!from || !to) return null;
            // A self-referencing segment (a road loop) has no line to draw.
            if (from.id === to.id) return null;
            return {
              id: segment.id,
              mode: segment.mode,
              // One entry per antimeridian-split run.
              runs: greatCircle(from, to) as LatLng[][],
            };
          })
          .filter((l): l is { id: string; mode: keyof typeof MODE_COLOR; runs: LatLng[][] } =>
            Boolean(l),
          );

        const nodes = new Map<string, Place>();
        journey.segments.forEach((segment) => {
          const from = placesById.get(segment.fromPlaceId);
          const to = placesById.get(segment.toPlaceId);
          if (from) nodes.set(from.id, from);
          if (to) nodes.set(to.id, to);
        });

        return { journey, lines, nodes: [...nodes.values()] };
      }),
    [journeys, placesById],
  );

  return (
    <>
      {drawn.map(({ journey, lines, nodes }) => {
        const dimmed = activeId !== null && activeId !== journey.id;
        const active = activeId === journey.id;
        const dashed = journey.status !== 'completed';

        return (
          <Fragment key={journey.id}>
            {lines.flatMap((line) =>
              line.runs.map((run, runIndex) => (
              <Polyline
                key={`${line.id}-${runIndex}`}
                positions={run}
                pathOptions={{
                  color: MODE_COLOR[line.mode],
                  weight: active ? 4 : 2.5,
                  opacity: dimmed ? 0.18 : active ? 1 : 0.75,
                  dashArray: dashed ? '6 6' : undefined,
                  lineCap: 'round',
                }}
                className={active ? 'route-glow' : undefined}
                eventHandlers={{
                  mouseover: (e) =>
                    onHover?.(journey, {
                      clientX: e.originalEvent.clientX,
                      clientY: e.originalEvent.clientY,
                    }),
                  mousemove: (e) =>
                    onHover?.(journey, {
                      clientX: e.originalEvent.clientX,
                      clientY: e.originalEvent.clientY,
                    }),
                  mouseout: () => onHover?.(null),
                  click: () => onSelect?.(journey),
                }}
              />
              )),
            )}

            {showNodes &&
              nodes.map((place) => (
                <CircleMarker
                  key={`${journey.id}-${place.id}`}
                  center={[place.lat, place.lon]}
                  radius={active ? 6 : 4.5}
                  pathOptions={{
                    color: '#e9c176',
                    weight: 2,
                    fillColor: '#ffffff',
                    fillOpacity: dimmed ? 0.2 : 1,
                    opacity: dimmed ? 0.2 : 1,
                  }}
                  eventHandlers={{
                    mouseover: (e) =>
                      onHover?.(journey, {
                        clientX: e.originalEvent.clientX,
                        clientY: e.originalEvent.clientY,
                      }),
                    mouseout: () => onHover?.(null),
                    click: () => onSelect?.(journey),
                  }}
                >
                  <Tooltip direction="top" offset={[0, -6]} opacity={1}>
                    <span className="font-label-caps text-[11px] uppercase tracking-widest">
                      {place.code ? `${place.name} (${place.code})` : place.name}
                    </span>
                  </Tooltip>
                </CircleMarker>
              ))}
          </Fragment>
        );
      })}
    </>
  );
}
