/** Public map hotspots on Zijingang Campus — heat evolves across the timeline. */

import { METERS_TO_LAT, metersToLng } from "@/lib/campus-map";

export const PUBLIC_MAP_YEARS = [2018, 2021, 2024, 2027] as const;

export type PublicPlacePhoto = {
  src: string;
  caption?: string;
};

export type HeatKeyframe = {
  /** Timeline position 0–1 */
  t: number;
  /** 0–1 visual weight for heat blob */
  intensity: number;
  /** Subtle east–west wobble in meters (stays on building) */
  offsetEastM: number;
  /** Subtle north–south wobble in meters (stays on building) */
  offsetNorthM: number;
};

export type PublicPlace = {
  id: string;
  name: string;
  tagline: string;
  lat: number;
  lng: number;
  photos: PublicPlacePhoto[];
  heatKeyframes: HeatKeyframe[];
};

/** Anchored on major built areas visible on the campus map */
export const PUBLIC_PLACES: PublicPlace[] = [
  {
    id: "east-gate",
    name: "East Gate Plaza",
    tagline: "The campus threshold — buses, bikes, and meetups",
    lat: 30.3076,
    lng: 120.0864,
    photos: [
      { src: "/scenes/desk3/photo-01.jpg", caption: "Morning rush" },
      { src: "/scenes/desk3/photo-02.jpg", caption: "Evening glow" },
    ],
    heatKeyframes: [
      { t: 0, intensity: 0.35, offsetEastM: 0, offsetNorthM: 0 },
      { t: 0.33, intensity: 0.55, offsetEastM: 8, offsetNorthM: -5 },
      { t: 0.66, intensity: 0.85, offsetEastM: -6, offsetNorthM: 10 },
      { t: 1, intensity: 1, offsetEastM: 0, offsetNorthM: 0 },
    ],
  },
  {
    id: "riverside",
    name: "Yuhangtang Riverside",
    tagline: "Paths along the river at the southern edge of campus",
    lat: 30.3021,
    lng: 120.0758,
    photos: [
      { src: "/scenes/desk1/photo-01.jpg", caption: "Morning mist" },
      { src: "/scenes/desk1/photo-02.jpg", caption: "Sunset walk" },
    ],
    heatKeyframes: [
      { t: 0, intensity: 0.2, offsetEastM: 0, offsetNorthM: 0 },
      { t: 0.33, intensity: 0.3, offsetEastM: 12, offsetNorthM: 0 },
      { t: 0.66, intensity: 0.45, offsetEastM: -10, offsetNorthM: 5 },
      { t: 1, intensity: 0.5, offsetEastM: 0, offsetNorthM: -8 },
    ],
  },
  {
    id: "yufeng-canteen",
    name: "Yufeng Canteen",
    tagline: "Lunch lines, late-night snacks, and weekend crowds",
    lat: 30.3061,
    lng: 120.0902,
    photos: [
      { src: "/scenes/dininghall1/photo-01.jpg", caption: "Lunch hour" },
      { src: "/scenes/dininghall2/photo-01.jpg", caption: "Evening crowd" },
    ],
    heatKeyframes: [
      { t: 0, intensity: 0.5, offsetEastM: 0, offsetNorthM: 0 },
      { t: 0.33, intensity: 0.7, offsetEastM: -10, offsetNorthM: 0 },
      { t: 0.66, intensity: 0.75, offsetEastM: 8, offsetNorthM: -6 },
      { t: 1, intensity: 0.9, offsetEastM: 0, offsetNorthM: 8 },
    ],
  },
  {
    id: "main-lawn",
    name: "Main Lawn",
    tagline: "Open grass, festivals, and afternoons between classes",
    lat: 30.3096,
    lng: 120.0800,
    photos: [
      { src: "/scenes/desk1/photo-02.jpg", caption: "Graduation day" },
      { src: "/scenes/desk3/photo-01.jpg", caption: "Club fair" },
    ],
    heatKeyframes: [
      { t: 0, intensity: 0.15, offsetEastM: 0, offsetNorthM: 0 },
      { t: 0.33, intensity: 0.4, offsetEastM: 0, offsetNorthM: 12 },
      { t: 0.66, intensity: 0.6, offsetEastM: -8, offsetNorthM: 0 },
      { t: 1, intensity: 0.7, offsetEastM: 10, offsetNorthM: -6 },
    ],
  },
];

export type ResolvedHeat = {
  intensity: number;
  lat: number;
  lng: number;
};

function lerp(a: number, b: number, u: number): number {
  return a + (b - a) * u;
}

function interpolateKeyframes(
  keyframes: HeatKeyframe[],
  t: number
): Omit<ResolvedHeat, "lat" | "lng"> & {
  offsetEastM: number;
  offsetNorthM: number;
} {
  const clamped = Math.max(0, Math.min(1, t));
  if (keyframes.length === 0) {
    return { intensity: 0, offsetEastM: 0, offsetNorthM: 0 };
  }
  if (keyframes.length === 1) {
    const k = keyframes[0];
    return {
      intensity: k.intensity,
      offsetEastM: k.offsetEastM,
      offsetNorthM: k.offsetNorthM,
    };
  }

  let i = 0;
  while (i < keyframes.length - 1 && keyframes[i + 1].t < clamped) i++;
  const a = keyframes[i];
  const b = keyframes[Math.min(i + 1, keyframes.length - 1)];
  if (a.t === b.t) {
    return {
      intensity: b.intensity,
      offsetEastM: b.offsetEastM,
      offsetNorthM: b.offsetNorthM,
    };
  }
  const u = (clamped - a.t) / (b.t - a.t);
  return {
    intensity: lerp(a.intensity, b.intensity, u),
    offsetEastM: lerp(a.offsetEastM, b.offsetEastM, u),
    offsetNorthM: lerp(a.offsetNorthM, b.offsetNorthM, u),
  };
}

export function heatForPlace(place: PublicPlace, t: number): ResolvedHeat {
  const { intensity, offsetEastM, offsetNorthM } = interpolateKeyframes(
    place.heatKeyframes,
    t
  );
  const baseLat = place.lat;
  return {
    intensity,
    lat: baseLat + offsetNorthM * METERS_TO_LAT,
    lng: place.lng + metersToLng(offsetEastM, baseLat),
  };
}

export function yearAtPublicTimeline(t: number): number {
  const min = PUBLIC_MAP_YEARS[0];
  const max = PUBLIC_MAP_YEARS[PUBLIC_MAP_YEARS.length - 1];
  return Math.round(min + t * (max - min));
}

export function placeById(id: string): PublicPlace | undefined {
  return PUBLIC_PLACES.find((p) => p.id === id);
}

/** Campus label shown in the public map chrome. */
export const PUBLIC_MAP_TITLE = "Zijingang Campus";
