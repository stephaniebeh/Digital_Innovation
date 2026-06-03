/** Pre-built timeline states — see public/scenes/README.md */

export type TimelineMoment = {
  id: string;
  year: number;
  label: string;
  /**
   * COLMAP dense point cloud (`fused.ply`) — clear preview, not Aholo-quality.
   * Served as scene.ply in public/scenes/{id}/
   */
  pointCloudUrl: string;
  /**
   * 3D Gaussian splat PLY exported from PostShot (`scene-splat.ply`).
   * When present, the viewer uses this for Aholo-like quality.
   */
  splatUrl?: string;
  photos?: { src: string; caption?: string }[];
};

export const SPLAT_FILENAME = "scene-splat.ply";
export const POINT_CLOUD_FILENAME = "scene.ply";

export function splatPathForMoment(id: string): string {
  return `/scenes/${id}/${SPLAT_FILENAME}`;
}

export const TIMELINE_YEARS = [2020, 2022, 2024, 2026] as const;

export const TIMELINE_MOMENTS: TimelineMoment[] = [
  {
    id: "desk1",
    year: 2020,
    label: "2020",
    pointCloudUrl: "/scenes/desk1/scene.ply",
    splatUrl: "/scenes/desk1/scene-splat.ply",
    photos: [
      { src: "/scenes/desk1/photo-01.jpg", caption: "Desk, winter light" },
      { src: "/scenes/desk1/photo-02.jpg", caption: "Corner detail" },
    ],
  },
  {
    id: "desk2",
    year: 2026,
    label: "2026",
    pointCloudUrl: "/scenes/desk2/scene.ply",
    splatUrl: "/scenes/desk2/scene-splat.ply",
    photos: [
      { src: "/scenes/desk2/photo-01.jpg", caption: "Desk, rearranged" },
      { src: "/scenes/desk2/photo-02.jpg", caption: "New objects" },
    ],
  },
];

export const RECONSTRUCTION_STAGES = [
  "Analysing photographs",
  "Matching viewpoints",
  "Reconstructing memory",
  "Generating scene",
] as const;

export function blendForTimelinePosition(t: number): number {
  return Math.max(0, Math.min(1, t));
}

export function yearAtTimelinePosition(t: number): number {
  const minYear = TIMELINE_YEARS[0];
  const maxYear = TIMELINE_YEARS[TIMELINE_YEARS.length - 1];
  return Math.round(minYear + t * (maxYear - minYear));
}

export async function assetExists(url: string): Promise<boolean> {
  try {
    const res = await fetch(url, { method: "HEAD" });
    return res.ok;
  } catch {
    return false;
  }
}

/** Prefer desk scene.ply; fall back to desk3 sample so the demo viewer is never empty. */
export async function resolvePointCloudUrl(
  preferredUrl: string
): Promise<{ url: string; fallback: boolean; missing: boolean }> {
  if (await assetExists(preferredUrl)) {
    return { url: preferredUrl, fallback: false, missing: false };
  }
  const sample = "/scenes/desk3/scene.ply";
  if (preferredUrl !== sample && (await assetExists(sample))) {
    return { url: sample, fallback: true, missing: false };
  }
  return { url: preferredUrl, fallback: false, missing: true };
}

export async function resolveSplatUrl(
  preferredUrl: string | undefined
): Promise<string | null> {
  if (!preferredUrl) return null;
  if (await assetExists(preferredUrl)) return preferredUrl;
  return null;
}
