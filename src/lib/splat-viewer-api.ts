import type { Object3D, Scene } from "three";

export type SplatViewerHandle = {
  /** Stable id for persistence (url, worldId, or desk path) */
  sceneKey: string;
  label: string;
  getSplatScene: () => Object3D | null;
  getViewer: () => import("@mkkellogg/gaussian-splats-3d").Viewer;
  getCamera: () => import("three").Camera | null;
  getHost: () => HTMLElement;
  requestRender: () => void;
};

export function requestViewerRender(
  viewer: import("@mkkellogg/gaussian-splats-3d").Viewer
): void {
  const v = viewer as { forceRenderNextFrame?: () => void };
  v.forceRenderNextFrame?.();
}

export function getViewerCanvas(
  viewer: import("@mkkellogg/gaussian-splats-3d").Viewer
): HTMLCanvasElement | null {
  const v = viewer as { renderer?: { domElement: HTMLCanvasElement } };
  return v.renderer?.domElement ?? null;
}

export type ViewerOrbitControls = {
  enabled: boolean;
  enableDamping: boolean;
  dampingFactor: number;
  zoomToCursor: boolean;
  minPolarAngle: number;
  maxPolarAngle: number;
  minAzimuthAngle: number;
  maxAzimuthAngle: number;
  mouseButtons: { LEFT: number; MIDDLE: number; RIGHT: number };
  target: import("three").Vector3;
  update: () => void;
};

/** Scene graph root for editor gizmos (TransformControls helper lives here). */
export function getViewerThreeScene(
  viewer: import("@mkkellogg/gaussian-splats-3d").Viewer,
  splatScene: Object3D | null
): Scene | null {
  const direct = (viewer as { threeScene?: Scene }).threeScene;
  if (direct?.isScene) return direct;

  let node: Object3D | null = splatScene;
  while (node) {
    if ((node as Scene).isScene) return node as Scene;
    node = node.parent;
  }
  return null;
}
