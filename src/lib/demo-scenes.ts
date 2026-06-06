/** Pre-built timeline states — see public/scenes/README.md */

export type TimelineMoment = {
  id: string;
  year: number;
  label: string;
  /** 3D Gaussian splat PLY (PostShot export or Aholo) — shown in the desk demo viewer */
  splatUrl: string;
  /**
   * COLMAP dense point cloud (`fused.ply` as scene.ply) — auto-align only, not rendered.
   */
  alignUrl: string;
  photos?: { src: string; caption?: string }[];
};

export const SPLAT_FILENAME = "scene-splat.ply";
export const ALIGN_FILENAME = "scene.ply";

export function splatPathForMoment(id: string): string {
  return `/scenes/${id}/${SPLAT_FILENAME}`;
}

export function alignPathForMoment(id: string): string {
  return `/scenes/${id}/${ALIGN_FILENAME}`;
}

/** Timeline slider endpoints (desk1 → desk3). */
export const TIMELINE_YEARS = [2020, 2023, 2026] as const;

export const TIMELINE_MOMENTS: TimelineMoment[] = [
  {
    id: "desk1",
    year: 2020,
    label: "2020",
    splatUrl: splatPathForMoment("desk1"),
    alignUrl: alignPathForMoment("desk1"),
    photos: [
      { src: "/scenes/desk1/photo-01.jpg", caption: "Desk, winter light" },
      { src: "/scenes/desk1/photo-02.jpg", caption: "Corner detail" },
    ],
  },
  {
    id: "desk3",
    year: 2023,
    label: "2023",
    splatUrl: splatPathForMoment("desk3"),
    alignUrl: alignPathForMoment("desk3"),
    photos: [
      { src: "/scenes/desk3/photo-01.jpg", caption: "Desk, middle era" },
      { src: "/scenes/desk3/photo-02.jpg", caption: "Detail" },
    ],
  },
  {
    id: "desk2",
    year: 2026,
    label: "2026",
    splatUrl: splatPathForMoment("desk2"),
    alignUrl: alignPathForMoment("desk2"),
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

export function momentIndexAtTimeline(t: number, count = TIMELINE_MOMENTS.length): number {
  if (count <= 1) return 0;
  return Math.min(count - 1, Math.round(t * (count - 1)));
}

export function timelineLabelAtPosition(
  t: number,
  overlayAll: boolean
): string {
  const moments = TIMELINE_MOMENTS;
  if (overlayAll) {
    return moments.map((m) => `${m.year}`).join(" · ");
  }
  const n = moments.length;
  if (n <= 1) return `${moments[0].year}`;

  const clamped = Math.max(0, Math.min(1, t));
  const pos = clamped * (n - 1);
  const iLow = Math.floor(pos);
  const iHigh = Math.min(n - 1, iLow + 1);
  const frac = pos - iLow;

  if (iLow !== iHigh && frac > 0.08 && frac < 0.92) {
    return `${moments[iLow].year} → ${moments[iHigh].year}`;
  }
  const m = moments[momentIndexAtTimeline(t, n)];
  return `${m.year}`;
}

export async function assetExists(url: string): Promise<boolean> {
  try {
    const res = await fetch(url, { method: "HEAD" });
    return res.ok;
  } catch {
    return false;
  }
}

export async function resolveSplatUrl(
  preferredUrl: string
): Promise<{ url: string; missing: boolean }> {
  const spzUrl = preferredUrl.replace(/\.ply$/i, ".spz");
  if (spzUrl !== preferredUrl && (await assetExists(spzUrl))) {
    return { url: spzUrl, missing: false };
  }
  if (await assetExists(preferredUrl)) {
    return { url: preferredUrl, missing: false };
  }
  return { url: preferredUrl, missing: true };
}

/** COLMAP point cloud for ICP auto-align (not shown in the splat viewer). */
export async function resolveAlignUrl(
  preferredUrl: string
): Promise<{ url: string; missing: boolean }> {
  if (await assetExists(preferredUrl)) {
    return { url: preferredUrl, missing: false };
  }
  return { url: preferredUrl, missing: true };
}

export const DEMO_SPLAT_SETUP_HINT =
  "Desk demo uses pre-baked files in public/scenes/ — run npm run bake-splats (desk1, desk3, desk2 folders) or save-desk-splat-from-world.";
