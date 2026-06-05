import * as THREE from "three";
import { requestViewerRender } from "@/lib/splat-viewer-api";

type SplatViewer = import("@mkkellogg/gaussian-splats-3d").Viewer;

type OrbitControlsLike = {
  target: THREE.Vector3;
  update: () => void;
  addEventListener?: (type: string, listener: () => void) => void;
  removeEventListener?: (type: string, listener: () => void) => void;
};

type ViewerWithCamera = SplatViewer & {
  camera?: THREE.Camera;
  controls?: OrbitControlsLike;
};

/** Copy orbit camera pose from one splat viewer to another. */
export function syncViewerCameraFrom(
  source: SplatViewer,
  target: SplatViewer
): void {
  const src = source as ViewerWithCamera;
  const dst = target as ViewerWithCamera;
  const srcCam = src.camera;
  const dstCam = dst.camera;
  const srcControls = src.controls;
  const dstControls = dst.controls;
  if (!srcCam || !dstCam || !srcControls || !dstControls) return;

  dstCam.position.copy(srcCam.position);
  dstCam.quaternion.copy(srcCam.quaternion);
  dstCam.up.copy(srcCam.up);

  if (
    srcCam instanceof THREE.PerspectiveCamera &&
    dstCam instanceof THREE.PerspectiveCamera
  ) {
    dstCam.fov = srcCam.fov;
    dstCam.zoom = srcCam.zoom;
    dstCam.near = srcCam.near;
    dstCam.far = srcCam.far;
    dstCam.aspect = srcCam.aspect;
    dstCam.updateProjectionMatrix();
  } else if (
    srcCam instanceof THREE.OrthographicCamera &&
    dstCam instanceof THREE.OrthographicCamera
  ) {
    dstCam.zoom = srcCam.zoom;
    dstCam.near = srcCam.near;
    dstCam.far = srcCam.far;
    dstCam.updateProjectionMatrix();
  }

  dstControls.target.copy(srcControls.target);
  dstControls.update();
  requestViewerRender(target);
}

export function bindAlignCameraSync(
  leader: SplatViewer,
  followers: SplatViewer[]
): () => void {
  const controls = (leader as ViewerWithCamera).controls;
  if (!controls?.addEventListener) {
    for (const follower of followers) {
      if (follower !== leader) syncViewerCameraFrom(leader, follower);
    }
    return () => {};
  }

  let syncing = false;

  const propagate = () => {
    if (syncing) return;
    syncing = true;
    for (const follower of followers) {
      if (follower !== leader) syncViewerCameraFrom(leader, follower);
    }
    syncing = false;
  };

  controls.addEventListener("change", propagate);
  propagate();

  return () => {
    controls.removeEventListener?.("change", propagate);
  };
}

/** Keep every viewer on the same orbit when any one is adjusted (timeline scrub). */
export function bindLinkedViewerCameras(viewers: SplatViewer[]): () => void {
  if (viewers.length < 2) return () => {};

  let syncing = false;
  const unsubs: Array<() => void> = [];

  const propagateFrom = (source: SplatViewer) => {
    if (syncing) return;
    syncing = true;
    for (const viewer of viewers) {
      if (viewer !== source) syncViewerCameraFrom(source, viewer);
    }
    syncing = false;
  };

  for (const viewer of viewers) {
    const controls = (viewer as ViewerWithCamera).controls;
    if (!controls?.addEventListener) continue;
    const onChange = () => propagateFrom(viewer);
    controls.addEventListener("change", onChange);
    unsubs.push(() => controls.removeEventListener?.("change", onChange));
  }

  return () => {
    for (const unsub of unsubs) unsub();
  };
}
