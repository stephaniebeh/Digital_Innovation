import * as THREE from "three";
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

/** Crossfade N timeline layers; t=0 → first scene, t=1 → last. */
export function applyTimelineLayerBlend(
  layers: HTMLElement[],
  t: number,
  overlayAll: boolean
): void {
  const n = layers.length;
  if (n === 0) return;

  if (overlayAll) {
    for (const el of layers) {
      el.style.display = "block";
      el.style.opacity = "1";
      el.style.pointerEvents = "auto";
    }
    return;
  }

  if (n === 1) {
    layers[0].style.display = "block";
    layers[0].style.opacity = "1";
    layers[0].style.pointerEvents = "auto";
    return;
  }

  const clamped = Math.max(0, Math.min(1, t));
  const pos = clamped * (n - 1);
  const iLow = Math.floor(pos);
  const iHigh = Math.min(n - 1, iLow + 1);
  const frac = pos - iLow;

  for (let k = 0; k < n; k++) {
    let opacity = 0;
    if (iLow === iHigh) {
      opacity = k === iLow ? 1 : 0;
    } else if (k === iLow) {
      opacity = 1 - frac;
    } else if (k === iHigh) {
      opacity = frac;
    }

    const el = layers[k];
    if (opacity <= 0.001) {
      el.style.display = "none";
      el.style.opacity = "0";
      el.style.pointerEvents = "none";
    } else {
      el.style.display = "block";
      el.style.opacity = String(opacity);
      el.style.pointerEvents = opacity >= 0.5 ? "auto" : "none";
    }
  }
}
