"use client";

import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "@/styles/campus-map.css";
import "leaflet.heat";
import {
  CAMPUS_DEFAULT_ZOOM,
  CAMPUS_MAX_ZOOM,
  CAMPUS_MIN_ZOOM,
  MAP_TILES,
  ZIJINGANG_BOUNDS,
  ZIJINGANG_CENTER,
  type MapStyle,
} from "@/lib/campus-map";
import { buildOrganicHeatPoints } from "@/lib/campus-heat-blobs";
import type { PublicPlace, ResolvedHeat } from "@/lib/public-places";

const HEAT_GRADIENT: Record<number, string> = {
  0.12: "rgba(59, 130, 246, 0)",
  0.4: "rgba(251, 191, 36, 0.4)",
  0.65: "rgba(251, 130, 60, 0.62)",
  0.85: "rgba(239, 68, 68, 0.78)",
  1: "rgba(220, 38, 38, 0.9)",
};

const HEAT_LAYER_OPTS = {
  radius: 28,
  blur: 22,
  maxZoom: CAMPUS_MAX_ZOOM,
  max: 0.48,
  minOpacity: 0.36,
  gradient: HEAT_GRADIENT,
} as const;

type HeatPoint = {
  place: PublicPlace;
  heat: ResolvedHeat;
};

type BaseTileLayers = {
  streets: L.TileLayer;
  satellite: L.TileLayer;
};

type Props = {
  heats: HeatPoint[];
  timelinePos: number;
  hoveredId: string | null;
  onHover: (id: string | null) => void;
  onSelectPlace: (place: PublicPlace) => void;
};

function resetLeafletContainer(el: HTMLDivElement) {
  el.replaceChildren();
  delete (el as HTMLDivElement & { _leaflet_id?: number })._leaflet_id;
}

function mapAlive(map: L.Map | null): map is L.Map {
  return Boolean(map && !(map as L.Map & { _removed?: boolean })._removed);
}

function createTileLayer(style: MapStyle): L.TileLayer {
  const config = MAP_TILES[style];
  return L.tileLayer(config.url, {
    attribution: config.attribution,
    maxZoom: CAMPUS_MAX_ZOOM,
    ...(config.subdomains ? { subdomains: config.subdomains } : {}),
    className:
      style === "streets" ? "campus-streets-tile" : "campus-satellite-tile",
  });
}

/** Keep both tile layers alive — only toggle opacity so Map always restores. */
function applyBaseMapStyle(layers: BaseTileLayers, style: MapStyle) {
  if (style === "streets") {
    layers.streets.setOpacity(1);
    layers.satellite.setOpacity(0);
    layers.streets.setZIndex(1);
    layers.satellite.setZIndex(0);
  } else {
    layers.streets.setOpacity(0);
    layers.satellite.setOpacity(1);
    layers.streets.setZIndex(0);
    layers.satellite.setZIndex(1);
  }
}

function initBaseTileLayers(map: L.Map): BaseTileLayers {
  const pane = map.getPane("tilePane");
  if (pane) pane.style.setProperty("background", "#000");

  const streets = createTileLayer("streets");
  const satellite = createTileLayer("satellite");

  streets.addTo(map);
  satellite.addTo(map);

  const layers = { streets, satellite };
  applyBaseMapStyle(layers, "streets");
  return layers;
}

export default function CampusMapLeaflet({
  heats,
  timelinePos,
  hoveredId,
  onHover,
  onSelectPlace,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const baseLayersRef = useRef<BaseTileLayers | null>(null);
  const heatRef = useRef<L.HeatLayer | null>(null);
  const markersRef = useRef<L.CircleMarker[]>([]);
  const destroyedRef = useRef(false);
  const heatsRef = useRef(heats);
  const hoveredIdRef = useRef(hoveredId);
  const onHoverRef = useRef(onHover);
  const onSelectRef = useRef(onSelectPlace);

  const [mapStyle, setMapStyle] = useState<MapStyle>("streets");
  const [ready, setReady] = useState(false);
  const [hoverPos, setHoverPos] = useState<{ x: number; y: number } | null>(
    null
  );

  const hovered = heats.find((h) => h.place.id === hoveredId);

  useEffect(() => {
    heatsRef.current = heats;
    hoveredIdRef.current = hoveredId;
    onHoverRef.current = onHover;
    onSelectRef.current = onSelectPlace;
  }, [heats, hoveredId, onHover, onSelectPlace]);

  useEffect(() => {
    destroyedRef.current = false;
    const el = containerRef.current;
    if (!el) return;

    let map: L.Map | null = null;
    let syncHoverPos: (() => void) | null = null;

    const init = () => {
      if (destroyedRef.current || !containerRef.current) return;
      if (
        (containerRef.current as HTMLDivElement & { _leaflet_id?: number })
          ._leaflet_id
      ) {
        return;
      }

      map = L.map(containerRef.current, {
        center: [ZIJINGANG_CENTER.lat, ZIJINGANG_CENTER.lng],
        zoom: CAMPUS_DEFAULT_ZOOM,
        minZoom: CAMPUS_MIN_ZOOM,
        maxZoom: CAMPUS_MAX_ZOOM,
        zoomControl: false,
        attributionControl: true,
      });

      const bounds = L.latLngBounds(
        [ZIJINGANG_BOUNDS.southWest.lat, ZIJINGANG_BOUNDS.southWest.lng],
        [ZIJINGANG_BOUNDS.northEast.lat, ZIJINGANG_BOUNDS.northEast.lng]
      );
      map.setMaxBounds(bounds.pad(0.05));

      L.control.zoom({ position: "bottomleft" }).addTo(map);

      mapRef.current = map;
      baseLayersRef.current = initBaseTileLayers(map);

      map.whenReady(() => {
        if (!mapAlive(map) || destroyedRef.current) return;
        map!.fitBounds(bounds, { padding: [24, 24] });
        map!.invalidateSize();
        setReady(true);
      });

      syncHoverPos = () => {
        const activeMap = mapRef.current;
        const id = hoveredIdRef.current;
        if (!mapAlive(activeMap) || !id) return;
        const target = heatsRef.current.find((h) => h.place.id === id);
        if (!target) return;
        const pt = activeMap.latLngToContainerPoint([
          target.heat.lat,
          target.heat.lng,
        ]);
        setHoverPos({ x: pt.x, y: pt.y });
      };

      map.on("move zoom resize", syncHoverPos);
    };

    const raf = requestAnimationFrame(init);

    return () => {
      destroyedRef.current = true;
      cancelAnimationFrame(raf);

      if (map && syncHoverPos) {
        map.off("move zoom resize", syncHoverPos);
      }

      if (heatRef.current && mapAlive(map)) {
        map!.removeLayer(heatRef.current);
      }
      heatRef.current = null;

      if (mapAlive(map)) {
        for (const marker of markersRef.current) {
          map!.removeLayer(marker);
        }
      }
      markersRef.current = [];

      if (baseLayersRef.current && mapAlive(map)) {
        map!.removeLayer(baseLayersRef.current.streets);
        map!.removeLayer(baseLayersRef.current.satellite);
      }
      baseLayersRef.current = null;

      if (mapAlive(map)) {
        map!.remove();
      }
      mapRef.current = null;

      if (containerRef.current) {
        resetLeafletContainer(containerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const layers = baseLayersRef.current;
    if (!layers || !ready) return;
    applyBaseMapStyle(layers, mapStyle);
  }, [mapStyle, ready]);

  useEffect(() => {
    const map = mapRef.current;
    if (!mapAlive(map) || !ready || destroyedRef.current) return;

    const heatPoints = buildOrganicHeatPoints(timelinePos);

    if (heatRef.current) {
      heatRef.current.setLatLngs(heatPoints);
      return;
    }

    if (heatPoints.length === 0) return;

    heatRef.current = L.heatLayer(heatPoints, { ...HEAT_LAYER_OPTS }).addTo(
      map
    );
  }, [timelinePos, ready]);

  useEffect(() => {
    const map = mapRef.current;
    if (!mapAlive(map) || !ready || destroyedRef.current) return;

    for (const marker of markersRef.current) {
      map.removeLayer(marker);
    }
    markersRef.current = [];

    for (const { place, heat } of heats) {
      if (heat.intensity < 0.4) continue;

      const isActive = hoveredId === place.id;
      const marker = L.circleMarker([heat.lat, heat.lng], {
        radius: isActive ? 9 : 7,
        color: isActive ? "#fde68a" : "#fbbf24",
        weight: isActive ? 3 : 2,
        fillColor: isActive ? "#fff7ed" : "#fbbf24",
        fillOpacity: isActive ? 0.95 : 0.85,
      });

      marker.on("mouseover", () => {
        onHoverRef.current(place.id);
        const activeMap = mapRef.current;
        if (!mapAlive(activeMap)) return;
        const pt = activeMap.latLngToContainerPoint([heat.lat, heat.lng]);
        setHoverPos({ x: pt.x, y: pt.y });
      });
      marker.on("mouseout", () => {
        onHoverRef.current(null);
        setHoverPos(null);
      });
      marker.on("click", () => onSelectRef.current(place));

      marker.addTo(map);
      markersRef.current.push(marker);
    }
  }, [heats, hoveredId, ready]);

  useEffect(() => {
    const map = mapRef.current;
    if (!mapAlive(map) || !hovered) {
      setHoverPos(null);
      return;
    }
    const pt = map.latLngToContainerPoint([
      hovered.heat.lat,
      hovered.heat.lng,
    ]);
    setHoverPos({ x: pt.x, y: pt.y });
  }, [hovered]);

  return (
    <div className="absolute inset-0">
      <div ref={containerRef} className="absolute inset-0 z-0 campus-map-host" />

      <div className="absolute top-24 right-4 z-[400] flex flex-col gap-1 pointer-events-auto">
        <button
          type="button"
          onClick={() => setMapStyle("streets")}
          className={`text-[10px] px-2.5 py-1.5 rounded-lg border backdrop-blur ${
            mapStyle === "streets"
              ? "border-amber-200/40 bg-black/70 text-amber-50"
              : "border-white/10 bg-black/50 text-zinc-400 hover:text-white"
          }`}
        >
          Map
        </button>
        <button
          type="button"
          onClick={() => setMapStyle("satellite")}
          className={`text-[10px] px-2.5 py-1.5 rounded-lg border backdrop-blur ${
            mapStyle === "satellite"
              ? "border-amber-200/40 bg-black/70 text-amber-50"
              : "border-white/10 bg-black/50 text-zinc-400 hover:text-white"
          }`}
        >
          Satellite
        </button>
      </div>

      {hovered && hoverPos && hovered.heat.intensity >= 0.4 && (
        <div
          className="absolute z-[500] pointer-events-auto max-w-[220px] rounded-xl border border-white/10 bg-black/85 backdrop-blur-md overflow-hidden shadow-xl"
          style={{
            left: hoverPos.x + 16,
            top: hoverPos.y - 8,
            transform: "translate(0, -50%)",
          }}
          onMouseEnter={() => onHover(hovered.place.id)}
          onMouseLeave={() => onHover(null)}
        >
          {hovered.place.photos[0] && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={hovered.place.photos[0].src}
              alt=""
              className="w-full aspect-[4/3] object-cover"
            />
          )}
          <div className="p-3 space-y-2">
            <div>
              <p className="text-sm font-medium text-white">
                {hovered.place.name}
              </p>
              <p className="text-[11px] text-zinc-500 line-clamp-2">
                {hovered.place.tagline}
              </p>
            </div>
            <button
              type="button"
              onClick={() => onSelectPlace(hovered.place)}
              className="w-full py-2 rounded-lg bg-amber-100/90 text-black text-xs font-medium hover:bg-white"
            >
              Step inside
            </button>
          </div>
        </div>
      )}

      {!ready && (
        <div className="absolute inset-0 flex items-center justify-center bg-zinc-950 text-sm text-zinc-500 z-10">
          Loading campus map…
        </div>
      )}
    </div>
  );
}
