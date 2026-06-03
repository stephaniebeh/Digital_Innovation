import * as THREE from "three";
import type { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

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
