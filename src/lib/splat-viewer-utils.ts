import * as THREE from "three";
import { TIMELINE_CROSSFADE_HALF_WIDTH } from "./splat-viewer-config";
import { syncViewerCanvasSize } from "./viewer-host";

type SplatViewer = import("@mkkellogg/gaussian-splats-3d").Viewer;

function forceRender(viewer: SplatViewer): void {
  const v = viewer as SplatViewer & { forceRenderNextFrame?: () => void };
  v.forceRenderNextFrame?.();
}

/** Frame camera on one viewer's splats (single scene per viewer). */
export function autoFrameSplatViewer(
  viewer: SplatViewer,
  host?: HTMLElement
): void {
  if (host) syncViewerCanvasSize(viewer, host);

  const mesh = viewer.getSplatMesh();
  const count = mesh.getSplatCount();
  if (count === 0) return;

  const camera = (viewer as SplatViewer & { camera?: THREE.Camera }).camera;
  const controls = (
    viewer as SplatViewer & {
      controls?: { target: THREE.Vector3; update: () => void };
    }
  ).controls;

  if (!camera || !controls) return;

  const center = new THREE.Vector3();
  let minX = Infinity;
  let minY = Infinity;
  let minZ = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  let maxZ = -Infinity;

  const step = Math.max(1, Math.floor(count / 1200));
  for (let i = 0; i < count; i += step) {
    mesh.getSplatCenter(i, center, true);
    minX = Math.min(minX, center.x);
    minY = Math.min(minY, center.y);
    minZ = Math.min(minZ, center.z);
    maxX = Math.max(maxX, center.x);
    maxY = Math.max(maxY, center.y);
    maxZ = Math.max(maxZ, center.z);
  }

  if (!Number.isFinite(minX)) return;

  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  const cz = (minZ + maxZ) / 2;
  const spanX = maxX - minX;
  const spanY = maxY - minY;
  const spanZ = maxZ - minZ;
  const radius = Math.max(spanX, spanY, spanZ, 0.3);
  const dist = radius * 2.2;

  controls.target.set(cx, cy, cz);
  camera.position.set(cx + dist * 0.15, cy + dist * 0.2, cz + dist * 0.85);

  if (camera instanceof THREE.PerspectiveCamera) {
    camera.near = Math.max(0.01, radius * 0.01);
    camera.far = Math.max(100, radius * 50);
    camera.fov = 50;
    camera.updateProjectionMatrix();
  }
  camera.lookAt(controls.target);
  controls.update();
  forceRender(viewer);
}

/** Crossfade layers: A = desk1 (2020), B = desk2 (2026). Hidden layer uses display:none. */
export function applyDeskLayerBlend(
  layerA: HTMLElement,
  layerB: HTMLElement,
  blend: number,
  overlayBoth: boolean
): void {
  const t = Math.max(0, Math.min(1, blend));
  const low = 0.5 - TIMELINE_CROSSFADE_HALF_WIDTH;
  const high = 0.5 + TIMELINE_CROSSFADE_HALF_WIDTH;

  if (overlayBoth) {
    layerA.style.display = "block";
    layerB.style.display = "block";
    layerA.style.opacity = "1";
    layerB.style.opacity = "1";
    layerA.style.pointerEvents = "auto";
    layerB.style.pointerEvents = "auto";
    return;
  }

  if (t <= low) {
    layerA.style.display = "block";
    layerA.style.opacity = "1";
    layerA.style.pointerEvents = "auto";
    layerB.style.display = "none";
    layerB.style.opacity = "0";
    layerB.style.pointerEvents = "none";
    return;
  }

  if (t >= high) {
    layerB.style.display = "block";
    layerB.style.opacity = "1";
    layerB.style.pointerEvents = "auto";
    layerA.style.display = "none";
    layerA.style.opacity = "0";
    layerA.style.pointerEvents = "none";
    return;
  }

  const fadeT = (t - low) / (high - low);
  layerA.style.display = "block";
  layerB.style.display = "block";
  layerA.style.opacity = String(1 - fadeT);
  layerB.style.opacity = String(fadeT);
  layerA.style.pointerEvents = fadeT < 0.5 ? "auto" : "none";
  layerB.style.pointerEvents = fadeT >= 0.5 ? "auto" : "none";
}
