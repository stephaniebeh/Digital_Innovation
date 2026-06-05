import * as THREE from "three";
import type { Viewer } from "@mkkellogg/gaussian-splats-3d";
import { requestViewerRender } from "@/lib/splat-viewer-api";

/** Max points drawn in the overlay (full index list is still kept for delete). */
const MAX_OVERLAY_POINTS = 24_000;

type HighlightState = {
  points: THREE.Points;
  scene: THREE.Scene;
};

const active = new WeakMap<Viewer, HighlightState>();

export function clearSelectionHighlight(viewer: Viewer): void {
  const state = active.get(viewer);
  if (!state) return;

  state.scene.remove(state.points);
  state.points.geometry.dispose();
  (state.points.material as THREE.Material).dispose();
  active.delete(viewer);
  requestViewerRender(viewer);
}

export function showSelectionHighlight(
  viewer: Viewer,
  threeScene: THREE.Scene,
  indices: number[]
): void {
  clearSelectionHighlight(viewer);
  if (indices.length === 0) return;

  const mesh = viewer.getSplatMesh();
  const center = new THREE.Vector3();
  const step =
    indices.length <= MAX_OVERLAY_POINTS
      ? 1
      : Math.ceil(indices.length / MAX_OVERLAY_POINTS);
  const drawCount = Math.ceil(indices.length / step);
  const positions = new Float32Array(drawCount * 3);

  let written = 0;
  for (let i = 0; i < indices.length; i += step) {
    mesh.getSplatCenter(indices[i], center, true);
    const base = written * 3;
    positions[base] = center.x;
    positions[base + 1] = center.y;
    positions[base + 2] = center.z;
    written++;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    "position",
    new THREE.BufferAttribute(positions.subarray(0, written * 3), 3)
  );

  const material = new THREE.PointsMaterial({
    color: 0xffc828,
    size: 6,
    sizeAttenuation: true,
    transparent: true,
    opacity: 0.9,
    depthTest: false,
    depthWrite: false,
  });

  const points = new THREE.Points(geometry, material);
  points.renderOrder = 10_000;
  threeScene.add(points);
  active.set(viewer, { points, scene: threeScene });
  requestViewerRender(viewer);
}
