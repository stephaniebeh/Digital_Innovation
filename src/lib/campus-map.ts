/** Zhejiang University — Zijingang Campus map configuration. */

export const ZIJINGANG_CENTER = {
  lat: 30.30685,
  lng: 120.08178,
} as const;

/** Keep users within the campus footprint while panning. */
export const ZIJINGANG_BOUNDS = {
  southWest: { lat: 30.2965, lng: 120.066 },
  northEast: { lat: 30.3175, lng: 120.097 },
} as const;

export const CAMPUS_DEFAULT_ZOOM = 15;
export const CAMPUS_MIN_ZOOM = 14;
export const CAMPUS_MAX_ZOOM = 19;

export type MapStyle = "streets" | "satellite";

/** Dark schematic tiles — light roads on a near-black base (CARTO Dark Matter). */
export const MAP_TILES: Record<
  MapStyle,
  { url: string; attribution: string; subdomains?: string }
> = {
  streets: {
    url: "https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}.png",
    subdomains: "abcd",
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/">CARTO</a>',
  },
  satellite: {
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    attribution:
      '&copy; <a href="https://www.esri.com/">Esri</a> &mdash; Earthstar Geographics',
  },
};

/** ~1° latitude ≈ 111 km; offsets in keyframes are small shifts in meters. */
export const METERS_TO_LAT = 1 / 111_320;
export const metersToLng = (meters: number, lat: number = ZIJINGANG_CENTER.lat) =>
  meters / (111_320 * Math.cos((lat * Math.PI) / 180));
