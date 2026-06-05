import * as THREE from "three";

type SplatViewer = import("@mkkellogg/gaussian-splats-3d").Viewer;

type ViewerWithRender = SplatViewer & {
  renderer?: THREE.WebGLRenderer;
  camera?: THREE.Camera;
  render?: () => void;
};

/** Draw gizmo handles above splats (the viewer renders splats after threeScene). */
export function styleGizmoOverlay(root: THREE.Object3D): void {
  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (!mesh.material) return;

    const materials = Array.isArray(mesh.material)
      ? mesh.material
      : [mesh.material];

    for (const material of materials) {
      material.depthTest = false;
      material.depthWrite = false;
      material.transparent = true;
    }

    obj.renderOrder = 1_000_000;
  });
}

/**
 * Render `overlayScene` after the splat pass so TransformControls stay clickable.
 * Returns a dispose function that restores the original viewer.render.
 */
export function mountEditorOverlayRender(
  viewer: SplatViewer,
  overlayScene: THREE.Scene
): () => void {
  const v = viewer as ViewerWithRender;
  const renderer = v.renderer;
  const origRender = v.render;

  if (!renderer || typeof origRender !== "function") {
    return () => {};
  }

  const patchedRender = function (this: ViewerWithRender) {
    origRender.call(this);
    const camera = this.camera;
    if (!this.renderer || !camera) return;

    const savedAutoClear = this.renderer.autoClear;
    this.renderer.autoClear = false;
    this.renderer.render(overlayScene, camera);
    this.renderer.autoClear = savedAutoClear;
  };

  v.render = patchedRender.bind(v);

  return () => {
    v.render = origRender;
  };
}
