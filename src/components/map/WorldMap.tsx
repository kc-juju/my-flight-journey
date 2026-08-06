import { useEffect, type ReactNode } from 'react';
import { MapContainer, TileLayer, ZoomControl, useMap } from 'react-leaflet';
import type { LatLngBoundsExpression } from 'leaflet';
import type { Journey, Place } from '../../types/journey';
import { boundsOf, type LatLng } from '../../lib/geo';
import { placesOfJourney } from '../../lib/atlas';
import { JourneyRoutes, type RouteHandlers } from './JourneyRoutes';

const TILE_URL = 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png';
const TILE_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>';

/**
 * Leaflet measures its container once at mount. Inside a card that is still
 * being laid out (or animated in) that measurement is zero, and the map never
 * requests a tile. Re-measure on mount and whenever the container resizes.
 */
function ResizeFix() {
  const map = useMap();

  useEffect(() => {
    const container = map.getContainer();
    const settle = () => map.invalidateSize({ animate: false });

    settle();
    const raf = requestAnimationFrame(settle);
    const timer = window.setTimeout(settle, 250);

    const observer = new ResizeObserver(settle);
    observer.observe(container);

    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(timer);
      observer.disconnect();
    };
  }, [map]);

  return null;
}

/** Flies the map to a journey when one is focused, and back out when cleared. */
function FocusController({
  focus,
  focusPlaces,
  placesById,
  defaultCenter,
  defaultZoom,
}: {
  focus: Journey | null;
  focusPlaces?: Place[];
  placesById: Map<string, Place>;
  defaultCenter: LatLng;
  defaultZoom: number;
}) {
  const map = useMap();

  useEffect(() => {
    if (!focus) {
      map.flyTo(defaultCenter, defaultZoom, { duration: 0.8 });
      return;
    }
    const source = focusPlaces?.length ? focusPlaces : placesOfJourney(focus, placesById);
    const points = source.map((p) => [p.lat, p.lon] as LatLng);
    const bounds = boundsOf(points, 6);
    if (bounds) {
      map.flyToBounds(bounds as LatLngBoundsExpression, {
        duration: 0.9,
        paddingTopLeft: [40, 40],
        paddingBottomRight: [40, 40],
      });
    }
  }, [focus, focusPlaces, map, placesById, defaultCenter, defaultZoom]);

  return null;
}

interface WorldMapProps extends RouteHandlers {
  journeys: Journey[];
  placesById: Map<string, Place>;
  activeId?: string | null;
  /** Journey to zoom to. Passing null returns to the world view. */
  focus?: Journey | null;
  /**
   * Frame these places instead of every place on the journey. Used to open on
   * the destinations rather than zooming out far enough to include home.
   */
  focusPlaces?: Place[];
  center?: LatLng;
  zoom?: number;
  className?: string;
  scrollWheelZoom?: boolean;
  children?: ReactNode;
}

export function WorldMap({
  journeys,
  placesById,
  activeId = null,
  focus = null,
  focusPlaces,
  center = [26, 116],
  zoom = 3,
  className = '',
  scrollWheelZoom = true,
  onHover,
  onSelect,
  children,
}: WorldMapProps) {
  return (
    <MapContainer
      center={center}
      zoom={zoom}
      minZoom={2}
      scrollWheelZoom={scrollWheelZoom}
      worldCopyJump={false}
      zoomControl={false}
      className={className}
      style={{ height: '100%', width: '100%' }}
    >
      <ResizeFix />
      <ZoomControl position="bottomright" />
      <TileLayer url={TILE_URL} attribution={TILE_ATTRIBUTION} subdomains="abcd" className="atlas-tiles" />
      <JourneyRoutes
        journeys={journeys}
        placesById={placesById}
        activeId={activeId}
        onHover={onHover}
        onSelect={onSelect}
      />
      <FocusController
        focus={focus}
        focusPlaces={focusPlaces}
        placesById={placesById}
        defaultCenter={center}
        defaultZoom={zoom}
      />
      {children}
    </MapContainer>
  );
}
