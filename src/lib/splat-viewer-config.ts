/** Tuning for Aholo / desk demo Gaussian splat viewers */

/**
 * Remove faint / stray Gaussians (0–255). Aholo’s viewer uses a similar filter;
 * ~20–35 reduces “blob” floaters without the old over-cull at 8.
 */
export const SPLAT_ALPHA_REMOVAL = 28;

/** Let library use default 1024 — low caps can look mushy on dense Aholo exports */
export const SPLAT_MAX_SCREEN_SIZE = 1024;

export const SPLAT_VIEWER_OPTIONS = {
  cameraUp: [0, 1, 0] as [number, number, number],
  initialCameraPosition: [0, 1.2, 3] as [number, number, number],
  initialCameraLookAt: [0, 0.35, 0] as [number, number, number],
  sharedMemoryForWorkers: false,
  sphericalHarmonicsDegree: 2,
  integerBasedSort: true,
  /** Required for move / rotate / scale in the scene editor */
  dynamicScene: true,
  /** Sharper splats on trained 3DGS exports (matches Aholo-style viewing better) */
  antialiased: true,
  focalAdjustment: 1.0,
  maxScreenSpaceSplatSize: SPLAT_MAX_SCREEN_SIZE,
  kernel2DSize: 0.25,
};

export const SPLAT_SCENE_LOAD_OPTIONS = {
  splatAlphaRemovalThreshold: SPLAT_ALPHA_REMOVAL,
  showLoadingUI: false,
  progressiveLoad: false,
};

export function splatFormatFromUrl(url: string): "ply" | "spz" {
  return url.toLowerCase().includes(".spz") ? "spz" : "ply";
}

/** Crossfade band around timeline midpoint (desk1 → desk2). */
export const TIMELINE_CROSSFADE_HALF_WIDTH = 0.1;
