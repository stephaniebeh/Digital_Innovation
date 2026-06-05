import type { Viewer } from "@mkkellogg/gaussian-splats-3d";
import type { Object3D } from "three";
import { applyDeletedSplatIndicesWhenReady } from "./splat-colors";
import type { SplatSceneEdit, SplatTransformEdit } from "./types";

export function applyTransformToObject(
  object: Object3D,
  transform: SplatTransformEdit
): void {
  object.position.set(...transform.position);
  object.rotation.set(...transform.rotation);
  object.scale.set(...transform.scale);
}

export function readTransformFromObject(object: Object3D): SplatTransformEdit {
  return {
    position: [object.position.x, object.position.y, object.position.z],
    rotation: [object.rotation.x, object.rotation.y, object.rotation.z],
    scale: [object.scale.x, object.scale.y, object.scale.z],
  };
}

export function applySplatEditToScene(
  object: Object3D,
  edit: SplatSceneEdit | null
): void {
  if (!edit) return;
  applyTransformToObject(object, edit.transform);
}

export function applySplatEdit(
  viewer: Viewer,
  object: Object3D,
  edit: SplatSceneEdit | null
): void {
  if (!edit) return;
  applyTransformToObject(object, edit.transform);
}

/** Run after viewer.start() so GPU textures exist before hiding splats. */
export function applySplatEditDeletes(
  viewer: Viewer,
  edit: SplatSceneEdit | null
): void {
  if (!edit?.deletedSplatIndices?.length) return;
  applyDeletedSplatIndicesWhenReady(viewer, edit.deletedSplatIndices);
}
