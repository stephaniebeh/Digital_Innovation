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

/** Desk demo has two eras; timeline ends map 0 → desk1, 1 → desk2 */
export const TIMELINE_YEARS = [2020, 2026] as const;

export const TIMELINE_MOMENTS: TimelineMoment[] = [
  {
    id: "desk1",
    year: 2020,
    label: "2020",
    splatUrl: "/scenes/desk1/scene-splat.ply",
    alignUrl: "/scenes/desk1/scene.ply",
    photos: [
      { src: "/scenes/desk1/photo-01.jpg", caption: "Desk, winter light" },
      { src: "/scenes/desk1/photo-02.jpg", caption: "Corner detail" },
    ],
  },
  {
    id: "desk2",
    year: 2026,
    label: "2026",
    splatUrl: "/scenes/desk2/scene-splat.ply",
    alignUrl: "/scenes/desk2/scene.ply",
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
  "Desk demo uses pre-baked files in public/scenes/ — not the same as a live Aholo upload until you refresh them. " +
  "npm run bake-splats (all photos) or npx tsx scripts/save-desk-splat-from-world.ts desk1 <worldId> after a good reconstruction.";
