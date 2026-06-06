/**
 * Organic building-centered heat — soft irregular clusters anchored on
 * campus landmarks, not straight paths or perfect circles.
 */

import { METERS_TO_LAT, metersToLng } from "@/lib/campus-map";
import {
  PUBLIC_PLACES,
  heatForPlace,
  type PublicPlace,
} from "@/lib/public-places";

type Footprint = {
  /** Typical building / plaza radius in meters */
  radiusM: number;
  /** 1 = round, >1 = slightly elongated */
  stretch: number;
  /** Degrees — orientation of stretch */
  angleDeg: number;
};

const FOOTPRINTS: Record<string, Footprint> = {
  "east-gate": { radiusM: 42, stretch: 1.15, angleDeg: 25 },
  "yufeng-canteen": { radiusM: 52, stretch: 1.25, angleDeg: -10 },
  "main-lawn": { radiusM: 72, stretch: 1.4, angleDeg: 40 },
  riverside: { radiusM: 38, stretch: 1.6, angleDeg: 85 },
};

function hashSeed(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return Math.abs(h);
}

/** Deterministic 0–1 noise — stable per place, shifts gently with timeline. */
function noise(placeId: string, i: number, t: number): number {
  const x = Math.sin(hashSeed(placeId) * 0.017 + i * 2.399 + t * 5.7) * 43758.5453;
  return x - Math.floor(x);
}

function addOrganicBlob(
  out: [number, number, number][],
  place: PublicPlace,
  heat: { lat: number; lng: number; intensity: number },
  t: number
) {
  const fp = FOOTPRINTS[place.id] ?? {
    radiusM: 40,
    stretch: 1.2,
    angleDeg: 0,
  };
  if (heat.intensity < 0.08) return;

  const angleRad = (fp.angleDeg * Math.PI) / 180;
  const cosA = Math.cos(angleRad);
  const sinA = Math.sin(angleRad);
  const count = 16 + Math.floor(heat.intensity * 24);

  for (let i = 0; i < count; i++) {
    const u = noise(place.id, i, t);
    const v = noise(place.id, i + 50, t);
    const w = noise(place.id, i + 100, t);

    // Denser toward centre, softer edges — irregular not perfectly round
    const dist = fp.radiusM * Math.pow(u, 0.72) * (0.82 + w * 0.28);
    const theta = v * Math.PI * 2;

    let eastM = dist * Math.cos(theta) * fp.stretch;
    let northM = dist * Math.sin(theta);

    const rotEast = eastM * cosA - northM * sinA;
    const rotNorth = eastM * sinA + northM * cosA;

    const lat = heat.lat + rotNorth * METERS_TO_LAT;
    const lng = heat.lng + metersToLng(rotEast, heat.lat);

    const edge = 1 - (dist / (fp.radiusM * fp.stretch)) * 0.9;
    const pointWeight = heat.intensity * Math.max(0, edge) * (0.35 + w * 0.4);
    if (pointWeight < 0.02) continue;

    out.push([lat, lng, pointWeight * 0.32]);
  }

  // Bright core on the building itself
  out.push([heat.lat, heat.lng, heat.intensity * 0.5]);
  for (let c = 0; c < 4; c++) {
    const j = fp.radiusM * 0.12;
    const ja = noise(place.id, c + 200, t) * Math.PI * 2;
    out.push([
      heat.lat + Math.sin(ja) * j * METERS_TO_LAT,
      heat.lng + metersToLng(Math.cos(ja) * j, heat.lat),
      heat.intensity * 0.38,
    ]);
  }
}

export function buildOrganicHeatPoints(t: number): [number, number, number][] {
  const points: [number, number, number][] = [];

  for (const place of PUBLIC_PLACES) {
    const heat = heatForPlace(place, t);
    addOrganicBlob(points, place, heat, t);
  }

  return points;
}
