import type { Object3D } from "three";

export type SceneTransform = {
  x: number;
  y: number;
  z: number;
  /** Pitch — default −90° corrects COLMAP Z-up to Y-up */
  rotationX: number;
  /** Yaw */
  rotationY: number;
  /** Roll */
  rotationZ: number;
  scale: number;
  flipX: number;
  flipY: number;
  flipZ: number;
};

export type SceneAlignmentState = {
  desk1: SceneTransform;
  desk2: SceneTransform;
  desk3: SceneTransform;
};

/** COLMAP → Y-up correction (radians) */
export const COLMAP_UPRIGHT_ROTATION_X = -Math.PI / 2;

export const DEFAULT_TRANSFORM: SceneTransform = {
  x: 0,
  y: 0,
  z: 0,
  rotationX: COLMAP_UPRIGHT_ROTATION_X,
  rotationY: 0,
  rotationZ: 0,
  scale: 1,
  flipX: 1,
  flipY: 1,
  flipZ: 1,
};

const STORAGE_KEY = "afterimage-scene-alignment-v2";

const DESK_IDS = ["desk1", "desk2", "desk3"] as const;

function normalizeTransform(raw: Partial<SceneTransform> | undefined): SceneTransform {
  const t = { ...DEFAULT_TRANSFORM, ...raw };
  if (raw && !("rotationX" in raw)) {
    t.rotationX = COLMAP_UPRIGHT_ROTATION_X;
  }
  return t;
}

function normalizeState(raw: Partial<SceneAlignmentState>): SceneAlignmentState {
  return {
    desk1: normalizeTransform(raw.desk1),
    desk2: normalizeTransform(raw.desk2),
    desk3: normalizeTransform(raw.desk3),
  };
}

export function defaultAlignment(): SceneAlignmentState {
  const base = { ...DEFAULT_TRANSFORM };
  return { desk1: { ...base }, desk2: { ...base }, desk3: { ...base } };
}

/** Aholo / 3DGS splats are already Y-up — no COLMAP −90° tilt on the viewer */
export function defaultSplatAlignment(): SceneAlignmentState {
  const base: SceneTransform = {
    ...DEFAULT_TRANSFORM,
    rotationX: 0,
    rotationY: 0,
    rotationZ: 0,
  };
  return { desk1: { ...base }, desk2: { ...base }, desk3: { ...base } };
}

export function loadAlignment(): SceneAlignmentState {
  if (typeof window === "undefined") return defaultAlignment();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      const legacy = localStorage.getItem("afterimage-scene-alignment-v1");
      if (legacy) {
        const parsed = JSON.parse(legacy) as Partial<SceneAlignmentState>;
        return normalizeState(parsed);
      }
      return defaultAlignment();
    }
    const parsed = JSON.parse(raw) as Partial<SceneAlignmentState>;
    return normalizeState(parsed);
  } catch {
    return defaultAlignment();
  }
}

export function saveAlignment(state: SceneAlignmentState): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export type SceneId = (typeof DESK_IDS)[number];

export const SCENE_IDS: SceneId[] = [...DESK_IDS];

export type GizmoMode = "translate" | "rotate" | "scale";

export function sceneTransformFromObject(object: Object3D): SceneTransform {
  const sx = object.scale.x;
  const sy = object.scale.y;
  const sz = object.scale.z;
  return {
    x: object.position.x,
    y: object.position.y,
    z: object.position.z,
    rotationX: object.rotation.x,
    rotationY: object.rotation.y,
    rotationZ: object.rotation.z,
    scale: (Math.abs(sx) + Math.abs(sy) + Math.abs(sz)) / 3,
    flipX: Math.sign(sx) || 1,
    flipY: Math.sign(sy) || 1,
    flipZ: Math.sign(sz) || 1,
  };
}

export function applySceneTransform(object: Object3D, t: SceneTransform): void {
  object.position.set(t.x, t.y, t.z);
  object.rotation.set(t.rotationX, t.rotationY, t.rotationZ);
  object.scale.set(
    t.scale * t.flipX,
    t.scale * t.flipY,
    t.scale * t.flipZ
  );
}

export function flipColmapVertical(t: SceneTransform): SceneTransform {
  const isUpright = Math.abs(t.rotationX - COLMAP_UPRIGHT_ROTATION_X) < 0.01;
  return {
    ...t,
    rotationX: isUpright ? Math.PI / 2 : COLMAP_UPRIGHT_ROTATION_X,
    flipY: t.flipY * -1,
  };
}
