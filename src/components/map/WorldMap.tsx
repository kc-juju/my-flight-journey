import { useEffect, useRef, type ReactNode } from 'react';
import { MapContainer, TileLayer, ZoomControl, useMap } from 'react-leaflet';
import { DomEvent, type LatLngBoundsExpression, type Map as LeafletMap } from 'leaflet';
import type { Journey, Place } from '../../types/journey';
import { boundsOf, type LatLng } from '../../lib/geo';
import { placesOfJourney } from '../../lib/atlas';
import { JourneyRoutes, type RouteHandlers } from './JourneyRoutes';
import { Icon } from '../ui/Icon';

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

/**
 * Fly to whatever this map is meant to be showing: the focused journey if
 * there is one, the opening centre otherwise.
 */
function showHome(
  map: LeafletMap,
  focus: Journey | null,
  focusPlaces: Place[] | undefined,
  placesById: Map<string, Place>,
  center: LatLng,
  zoom: number,
) {
  if (focus) {
    const source = focusPlaces?.length ? focusPlaces : placesOfJourney(focus, placesById);
    const bounds = boundsOf(source.map((p) => [p.lat, p.lon] as LatLng), 6);
    if (bounds) {
      map.flyToBounds(bounds as LatLngBoundsExpression, {
        duration: 0.9,
        paddingTopLeft: [40, 40],
        paddingBottomRight: [40, 40],
      });
      return;
    }
  }
  map.flyTo(center, zoom, { duration: 0.9 });
}

/**
 * Take me back. Panning across the Pacific is easy to do and tedious to
 * undo, so the view the map opened with is always one click away.
 */
function RecentreControl({
  focus,
  focusPlaces,
  placesById,
  center,
  zoom,
  onRecentre,
}: {
  focus: Journey | null;
  focusPlaces?: Place[];
  placesById: Map<string, Place>;
  center: LatLng;
  zoom: number;
  onRecentre?: () => void;
}) {
  const map = useMap();
  const button = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    // Without this a click on the button also reaches the map underneath.
    if (button.current) DomEvent.disableClickPropagation(button.current);
  }, []);

  return (
    <button
      ref={button}
      type="button"
      title="Back to the opening view"
      aria-label="Back to the opening view"
      onClick={() => {
        onRecentre?.();
        showHome(map, focus, focusPlaces, placesById, center, zoom);
      }}
      className="absolute bottom-24 right-3 z-[800] flex h-9 w-9 items-center justify-center rounded-lg border border-outline-variant bg-surface-container-lowest text-on-surface shadow-md transition-colors hover:bg-surface-container"
    >
      <Icon name="my_location" className="text-[18px]" />
    </button>
  );
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
  const lastFocus = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    const id = focus?.id ?? null;
    // Only move when the focused journey actually changes. The effect used to
    // depend on freshly-built default arrays, so every unrelated re-render —
    // hovering a route, say — snapped the map back to where it started.
    if (lastFocus.current === id) return;
    const first = lastFocus.current === undefined;
    lastFocus.current = id;

    if (!id) {
      // Nothing to focus. Leave the view alone on first mount, and only
      // return to the default when a journey was actually being shown.
      if (!first) map.flyTo(defaultCenter, defaultZoom, { duration: 0.8 });
      return;
    }

    const source = focusPlaces?.length ? focusPlaces : placesOfJourney(focus!, placesById);
    const points = source.map((p) => [p.lat, p.lon] as LatLng);
    const bounds = boundsOf(points, 6);
    if (bounds) {
      map.flyToBounds(bounds as LatLngBoundsExpression, {
        duration: 0.9,
        paddingTopLeft: [40, 40],
        paddingBottomRight: [40, 40],
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focus?.id, map]);

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
  /** Called when the reader asks for the opening view back. */
  onRecentre?: () => void;
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
  onRecentre,
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
      <RecentreControl
        focus={focus}
        focusPlaces={focusPlaces}
        placesById={placesById}
        center={center}
        zoom={zoom}
        onRecentre={onRecentre}
      />
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
