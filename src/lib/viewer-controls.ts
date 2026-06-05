import * as THREE from "three";
import type { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import type { SplatEditTool } from "@/lib/splat-editor/types";
import type { ViewerOrbitControls } from "@/lib/splat-viewer-api";

type SplatViewer = import("@mkkellogg/gaussian-splats-3d").Viewer;

type SplatViewerControls = {
  controls?: ViewerOrbitControls | null;
  perspectiveControls?: ViewerOrbitControls | null;
  orthographicControls?: ViewerOrbitControls | null;
};

function enableZoomToCursor(controls: ViewerOrbitControls | null | undefined): void {
  if (!controls) return;
  controls.zoomToCursor = true;
  controls.update();
}

/** Scroll zooms toward the pointer (OrbitControls zoomToCursor). */
export function configureSplatViewerOrbit(viewer: SplatViewer): void {
  const v = viewer as SplatViewerControls;
  enableZoomToCursor(v.perspectiveControls);
  enableZoomToCursor(v.orthographicControls);
  enableZoomToCursor(v.controls);
}

/** Orbit + pan setup similar to desktop 3D viewers (avoids pole lock at top/bottom). */
export function configureExplorationControls(
  controls: OrbitControls,
  camera: THREE.PerspectiveCamera
): void {
  camera.up.set(0, 1, 0);

  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.rotateSpeed = 0.7;
  controls.zoomSpeed = 1.15;
  controls.panSpeed = 0.9;
  controls.enablePan = true;
  controls.screenSpacePanning = true;
  controls.enableZoom = true;

  controls.minDistance = 0.05;
  controls.maxDistance = 800;

  // Stay slightly off the poles so orbit does not "stick" (gimbal lock).
  controls.minPolarAngle = 0.12;
  controls.maxPolarAngle = Math.PI - 0.12;

  controls.mouseButtons = {
    LEFT: THREE.MOUSE.ROTATE,
    MIDDLE: THREE.MOUSE.DOLLY,
    RIGHT: THREE.MOUSE.PAN,
  };
  controls.zoomToCursor = true;
}

type SavedOrbitState = {
  enableDamping: boolean;
  dampingFactor: number;
  mouseButtons: { LEFT: number; MIDDLE: number; RIGHT: number };
};

/** Editor: no inertia drift; select tool reserves left-drag for box select. */
export function applyEditorOrbitControls(
  controls: ViewerOrbitControls,
  tool: SplatEditTool
): SavedOrbitState {
  const saved: SavedOrbitState = {
    enableDamping: controls.enableDamping,
    dampingFactor: controls.dampingFactor,
    mouseButtons: { ...controls.mouseButtons },
  };

  controls.enableDamping = false;

  if (tool === "select") {
    controls.mouseButtons = {
      LEFT: -1,
      MIDDLE: THREE.MOUSE.DOLLY,
      RIGHT: THREE.MOUSE.ROTATE,
    };
  } else {
    controls.mouseButtons = {
      LEFT: THREE.MOUSE.ROTATE,
      MIDDLE: THREE.MOUSE.DOLLY,
      RIGHT: THREE.MOUSE.PAN,
    };
  }

  return saved;
}

export function restoreOrbitControls(
  controls: ViewerOrbitControls,
  saved: SavedOrbitState
): void {
  controls.enableDamping = saved.enableDamping;
  controls.dampingFactor = saved.dampingFactor;
  controls.mouseButtons = { ...saved.mouseButtons };
}

export function frameCameraOnObject(
  camera: THREE.PerspectiveCamera,
  controls: OrbitControls,
  object: THREE.Object3D
): void {
  const box = new THREE.Box3().setFromObject(object);
  if (box.isEmpty()) return;

  const center = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3()).length();
  const dist = Math.max(size * 1.35, 0.75);

  camera.position.set(
    center.x + dist * 0.75,
    center.y + dist * 0.45,
    center.z + dist * 0.75
  );
  controls.target.copy(center);
  controls.update();
}
