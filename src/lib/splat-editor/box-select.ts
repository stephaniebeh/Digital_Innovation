import * as THREE from "three";
import type { Camera } from "three";
import type { Viewer } from "@mkkellogg/gaussian-splats-3d";

export type ScreenRect = {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
};

export function normalizeScreenRect(rect: ScreenRect): ScreenRect {
  return {
    x1: Math.min(rect.x1, rect.x2),
    y1: Math.min(rect.y1, rect.y2),
    x2: Math.max(rect.x1, rect.x2),
    y2: Math.max(rect.y1, rect.y2),
  };
}

export function rectFromPoints(
  startX: number,
  startY: number,
  endX: number,
  endY: number
): ScreenRect {
  return normalizeScreenRect({ x1: startX, y1: startY, x2: endX, y2: endY });
}

function pointInRect(x: number, y: number, rect: ScreenRect): boolean {
  return x >= rect.x1 && x <= rect.x2 && y >= rect.y1 && y <= rect.y2;
}

function prepareCamera(camera: Camera): void {
  camera.updateMatrixWorld(true);
  if (camera instanceof THREE.PerspectiveCamera) {
    camera.updateProjectionMatrix();
  }
}

/** Splats whose projected centers fall inside the screen drag rectangle. */
export function splatIndicesInScreenRect(
  viewer: Viewer,
  camera: Camera,
  canvas: HTMLCanvasElement,
  rect: ScreenRect
): number[] {
  const mesh = viewer.getSplatMesh();
  const count = mesh.getSplatCount();
  if (count === 0) return [];

  const normalized = normalizeScreenRect(rect);
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  if (width < 1 || height < 1) return [];

  const rectW = normalized.x2 - normalized.x1;
  const rectH = normalized.y2 - normalized.y1;
  if (rectW < 4 && rectH < 4) return [];

  prepareCamera(camera);

  const center = new THREE.Vector3();
  const projected = new THREE.Vector3();
  const toSplat = new THREE.Vector3();
  const cameraPos = new THREE.Vector3();
  const cameraDir = new THREE.Vector3();
  camera.getWorldPosition(cameraPos);
  camera.getWorldDirection(cameraDir);

  const selected: number[] = [];

  for (let i = 0; i < count; i++) {
    mesh.getSplatCenter(i, center, true);
    toSplat.copy(center).sub(cameraPos);
    if (toSplat.dot(cameraDir) <= 0) continue;

    projected.copy(center).project(camera);
    if (projected.z < -1 || projected.z > 1) continue;

    const sx = (projected.x * 0.5 + 0.5) * width;
    const sy = (-projected.y * 0.5 + 0.5) * height;
    if (pointInRect(sx, sy, normalized)) {
      selected.push(i);
    }
  }

  if (selected.length === 0) return [];
  if (selected.length > count * 0.45) return [];

  return selected;
}
