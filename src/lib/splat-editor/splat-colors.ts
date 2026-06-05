import type { Viewer } from "@mkkellogg/gaussian-splats-3d";
import { requestViewerRender } from "@/lib/splat-viewer-api";

type SplatMeshGpu = {
  getSplatCount(): number;
  splatDataTextures?: {
    baseData?: { colors?: Uint8Array };
    centerColors?: {
      data?: Uint32Array;
      texture?: { needsUpdate: boolean };
    };
  };
  updateDataTexturesFromBaseData?: (from: number, to: number) => void;
};

function gpuColorData(mesh: SplatMeshGpu): Uint8Array | null {
  return mesh.splatDataTextures?.baseData?.colors ?? null;
}

function canGpuHide(mesh: SplatMeshGpu): boolean {
  return (
    gpuColorData(mesh) !== null &&
    mesh.splatDataTextures?.centerColors?.data !== undefined &&
    typeof mesh.updateDataTexturesFromBaseData === "function"
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
  const total = mesh.getSplatCount();
  const unique = [...new Set(indices)].filter((i) => i >= 0 && i < total);
  if (unique.length === 0 || unique.length >= total * 0.98) return;

  let min = total;
  let max = 0;
  for (const index of unique) {
    colors[index * 4 + 3] = 0;
    if (index < min) min = index;
    if (index > max) max = index;
  }

  mesh.updateDataTexturesFromBaseData!(min, max);
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
