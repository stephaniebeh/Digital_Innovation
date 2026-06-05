import * as THREE from "three";
import type { Viewer } from "@mkkellogg/gaussian-splats-3d";
import { requestViewerRender } from "@/lib/splat-viewer-api";

type SplatMeshGpu = {
  getSplatCount(): number;
  getSplatColor(index: number, out: THREE.Vector4): void;
  splatDataTextures?: {
    baseData?: { colors?: Uint8Array; centers?: Float32Array };
    centerColors?: {
      data?: Uint32Array;
      texture?: { needsUpdate: boolean };
    };
  };
};

const floatView = new Float32Array(1);
const int32View = new Int32Array(floatView.buffer);

function uintEncodedFloat(value: number): number {
  floatView[0] = value;
  return int32View[0];
}

function rgbaArrayToInteger(colors: Uint8Array, offset: number): number {
  return (
    colors[offset] +
    (colors[offset + 1] << 8) +
    (colors[offset + 2] << 16) +
    (colors[offset + 3] << 24)
  );
}

function gpuColorData(mesh: SplatMeshGpu): Uint8Array | null {
  return mesh.splatDataTextures?.baseData?.colors ?? null;
}

function splatCapacity(mesh: SplatMeshGpu): number {
  const colors = gpuColorData(mesh);
  const centers = mesh.splatDataTextures?.baseData?.centers;
  const padded = mesh.splatDataTextures?.centerColors?.data;
  if (!colors || !centers || !padded) return 0;

  return Math.min(
    Math.floor(colors.length / 4),
    Math.floor(centers.length / 3),
    Math.floor(padded.length / 4),
    mesh.getSplatCount()
  );
}

function canGpuHide(mesh: SplatMeshGpu): boolean {
  return splatCapacity(mesh) > 0;
}

function syncCenterColorForSplat(
  index: number,
  centers: Float32Array,
  colors: Uint8Array,
  paddedCenterColors: Uint32Array
): void {
  const colorsBase = index * 4;
  const centersBase = index * 3;
  const centerColorsBase = index * 4;
  paddedCenterColors[centerColorsBase] = rgbaArrayToInteger(colors, colorsBase);
  paddedCenterColors[centerColorsBase + 1] = uintEncodedFloat(centers[centersBase]);
  paddedCenterColors[centerColorsBase + 2] = uintEncodedFloat(centers[centersBase + 1]);
  paddedCenterColors[centerColorsBase + 3] = uintEncodedFloat(centers[centersBase + 2]);
}

function normalizeDeleteIndices(indices: number[], capacity: number): number[] {
  return [...new Set(indices)].filter(
    (index) => Number.isInteger(index) && index >= 0 && index < capacity
  );
}

/**
 * Hide splats by zeroing alpha in the live GPU color buffer only.
 * Avoids refreshDataTexturesFromSplatBuffers(), which rebuilds all textures and
 * was clearing the entire scene.
 */
export function hideSplatIndices(viewer: Viewer, indices: number[]): void {
  if (indices.length === 0) return;

  const mesh = viewer.getSplatMesh() as unknown as SplatMeshGpu;
  if (!canGpuHide(mesh)) {
    applyDeletedSplatIndicesWhenReady(viewer, indices);
    return;
  }

  const colors = gpuColorData(mesh)!;
  const centers = mesh.splatDataTextures!.baseData!.centers!;
  const padded = mesh.splatDataTextures!.centerColors!.data!;
  const capacity = splatCapacity(mesh);
  const unique = normalizeDeleteIndices(indices, capacity);
  if (unique.length === 0 || unique.length >= capacity * 0.98) return;

  for (const index of unique) {
    colors[index * 4 + 3] = 0;
    syncCenterColorForSplat(index, centers, colors, padded);
  }

  const tex = mesh.splatDataTextures?.centerColors?.texture;
  if (tex) tex.needsUpdate = true;
  requestViewerRender(viewer);
}

export function applyDeletedSplatIndices(
  viewer: Viewer,
  deletedSplatIndices: number[] | undefined
): void {
  if (!deletedSplatIndices?.length) return;
  hideSplatIndices(viewer, deletedSplatIndices);
}

/**
 * Bring back hidden splats by copying original RGBA from the splat buffer
 * (not the zeroed GPU color).
 */
export function restoreSplatIndices(viewer: Viewer, indices: number[]): void {
  if (indices.length === 0) return;

  const mesh = viewer.getSplatMesh() as unknown as SplatMeshGpu;
  if (!canGpuHide(mesh)) {
    restoreDeletedSplatIndicesWhenReady(viewer, indices);
    return;
  }

  const colors = gpuColorData(mesh)!;
  const centers = mesh.splatDataTextures!.baseData!.centers!;
  const padded = mesh.splatDataTextures!.centerColors!.data!;
  const capacity = splatCapacity(mesh);
  const unique = normalizeDeleteIndices(indices, capacity);
  if (unique.length === 0) return;

  const colorOut = new THREE.Vector4();
  for (const index of unique) {
    mesh.getSplatColor(index, colorOut);
    const base = index * 4;
    colors[base] = colorOut.x;
    colors[base + 1] = colorOut.y;
    colors[base + 2] = colorOut.z;
    colors[base + 3] = colorOut.w;
    syncCenterColorForSplat(index, centers, colors, padded);
  }

  const tex = mesh.splatDataTextures?.centerColors?.texture;
  if (tex) tex.needsUpdate = true;
  requestViewerRender(viewer);
}

export function restoreDeletedSplatIndices(
  viewer: Viewer,
  deletedSplatIndices: number[] | undefined
): void {
  if (!deletedSplatIndices?.length) return;
  restoreSplatIndices(viewer, deletedSplatIndices);
}

/** Call after viewer.start() once GPU textures exist. */
export function restoreDeletedSplatIndicesWhenReady(
  viewer: Viewer,
  deletedSplatIndices: number[] | undefined,
  attemptsLeft = 60
): void {
  if (!deletedSplatIndices?.length) return;

  const mesh = viewer.getSplatMesh() as unknown as SplatMeshGpu;
  if (canGpuHide(mesh)) {
    restoreSplatIndices(viewer, deletedSplatIndices);
    return;
  }

  if (attemptsLeft <= 0) return;
  requestAnimationFrame(() =>
    restoreDeletedSplatIndicesWhenReady(viewer, deletedSplatIndices, attemptsLeft - 1)
  );
}

/** Call after viewer.start() once the splat mesh GPU textures exist. */
export function applyDeletedSplatIndicesWhenReady(
  viewer: Viewer,
  deletedSplatIndices: number[] | undefined,
  attemptsLeft = 60
): void {
  if (!deletedSplatIndices?.length) return;

  const mesh = viewer.getSplatMesh() as unknown as SplatMeshGpu;
  if (canGpuHide(mesh)) {
    hideSplatIndices(viewer, deletedSplatIndices);
    return;
  }

  if (attemptsLeft <= 0) return;
  requestAnimationFrame(() =>
    applyDeletedSplatIndicesWhenReady(viewer, deletedSplatIndices, attemptsLeft - 1)
  );
}
