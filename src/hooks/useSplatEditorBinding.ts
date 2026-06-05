"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { TransformControls } from "three/examples/jsm/controls/TransformControls.js";
import {
  applyTransformToObject,
  readTransformFromObject,
} from "@/lib/splat-editor/apply-edit";
import { rectFromPoints, splatIndicesInScreenRect } from "@/lib/splat-editor/box-select";
import { hideSplatIndices } from "@/lib/splat-editor/splat-colors";
import {
  clearSelectionHighlight,
  showSelectionHighlight,
} from "@/lib/splat-editor/selection-highlight";
import type { SplatCropBox, SplatEditTool, SplatSceneEdit } from "@/lib/splat-editor/types";
import type { SplatViewerHandle } from "@/lib/splat-viewer-api";
import {
  mountEditorOverlayRender,
  styleGizmoOverlay,
} from "@/lib/editor-gizmo-overlay";
import {
  getViewerCanvas,
  getViewerThreeScene,
  requestViewerRender,
  type ViewerOrbitControls,
} from "@/lib/splat-viewer-api";
import {
  applyEditorOrbitControls,
  restoreOrbitControls,
} from "@/lib/viewer-controls";

type Params = {
  handle: SplatViewerHandle | null;
  tool: SplatEditTool;
  edit: SplatSceneEdit;
  onEditChange: (patch: Partial<SplatSceneEdit>) => void;
  enabled: boolean;
};

export function defaultCropFromScene(scene: THREE.Object3D): SplatCropBox {
  const box = new THREE.Box3().setFromObject(scene);
  if (!Number.isFinite(box.min.x)) {
    return { min: [-1, -1, -1], max: [1, 1, 1] };
  }
  const pad = 0.05;
  return {
    min: [box.min.x - pad, box.min.y - pad, box.min.z - pad],
    max: [box.max.x + pad, box.max.y + pad, box.max.z + pad],
  };
}

export function useSplatEditorBinding({
  handle,
  tool,
  edit,
  onEditChange,
  enabled,
}: Params): void {
  const controlsRef = useRef<TransformControls | null>(null);
  const cropMeshRef = useRef<THREE.Mesh | null>(null);
  const cropGroupRef = useRef<THREE.Group | null>(null);
  const gizmoRootRef = useRef<THREE.Object3D | null>(null);
  const selectedIndicesRef = useRef<number[]>([]);
  const editRef = useRef(edit);
  editRef.current = edit;

  useEffect(() => {
    if (!enabled || !handle) return;

    const viewer = handle.getViewer();
    const orbit = (viewer as { controls?: ViewerOrbitControls }).controls;
    if (!orbit) return;

    const saved = applyEditorOrbitControls(orbit, tool);
    orbit.enabled = false;

    return () => {
      restoreOrbitControls(orbit, saved);
      orbit.enabled = true;
    };
  }, [handle, enabled, tool]);

  useEffect(() => {
    if (!enabled || !handle || tool !== "select") {
      selectedIndicesRef.current = [];
      if (handle) clearSelectionHighlight(handle.getViewer());
      return;
    }

    const viewer = handle.getViewer();
    const camera = handle.getCamera();
    const canvas = getViewerCanvas(viewer);
    const host = handle.getHost();
    const sceneObj = handle.getSplatScene();
    const orbit = (viewer as { controls?: ViewerOrbitControls }).controls;
    const threeScene = sceneObj ? getViewerThreeScene(viewer, sceneObj) : null;
    if (!camera || !canvas || !orbit || !threeScene) return;

    const overlay = document.createElement("div");
    const dragStyle =
      "position:absolute;pointer-events:none;border:1px solid rgba(56,189,248,0.95);background:rgba(56,189,248,0.14);display:none;z-index:30;box-sizing:border-box;";
    const selectedStyle =
      "position:absolute;pointer-events:none;border:2px solid rgba(255,200,40,0.5);background:rgba(255,200,40,0.06);display:none;z-index:30;box-sizing:border-box;";
    overlay.style.cssText = dragStyle;
    host.style.position = host.style.position || "relative";
    host.appendChild(overlay);

    const badge = document.createElement("div");
    badge.style.cssText =
      "position:absolute;pointer-events:none;display:none;z-index:31;padding:2px 6px;border-radius:4px;background:rgba(9,9,11,0.85);color:rgba(255,200,40,0.95);font-size:10px;font-family:system-ui,sans-serif;white-space:nowrap;";
    host.appendChild(badge);

    let dragging = false;
    let startX = 0;
    let startY = 0;
    let pointerId: number | null = null;

    const canvasRect = () => canvas.getBoundingClientRect();

    const updateOverlay = (x1: number, y1: number, x2: number, y2: number) => {
      const rect = rectFromPoints(x1, y1, x2, y2);
      const hostBounds = host.getBoundingClientRect();
      const bounds = canvasRect();
      overlay.style.cssText = dragStyle;
      overlay.style.display = "block";
      overlay.style.left = `${bounds.left - hostBounds.left + rect.x1}px`;
      overlay.style.top = `${bounds.top - hostBounds.top + rect.y1}px`;
      overlay.style.width = `${rect.x2 - rect.x1}px`;
      overlay.style.height = `${rect.y2 - rect.y1}px`;
    };

    const hideOverlay = () => {
      overlay.style.display = "none";
      badge.style.display = "none";
    };

    const showSelectedOverlay = (
      x1: number,
      y1: number,
      x2: number,
      y2: number,
      count: number
    ) => {
      const rect = rectFromPoints(x1, y1, x2, y2);
      const hostBounds = host.getBoundingClientRect();
      const bounds = canvasRect();
      overlay.style.cssText = selectedStyle;
      overlay.style.display = "block";
      overlay.style.left = `${bounds.left - hostBounds.left + rect.x1}px`;
      overlay.style.top = `${bounds.top - hostBounds.top + rect.y1}px`;
      overlay.style.width = `${rect.x2 - rect.x1}px`;
      overlay.style.height = `${rect.y2 - rect.y1}px`;

      if (count > 0) {
        badge.textContent = `${count.toLocaleString()} selected`;
        badge.style.display = "block";
        badge.style.left = `${overlay.style.left}`;
        badge.style.top = `calc(${overlay.style.top} - 22px)`;
      } else {
        badge.style.display = "none";
      }
    };

    const enableOrbitForButton = (button: number) => {
      if (button === 0) return;
      orbit.enabled = true;
    };

    const disableOrbitIfNeeded = () => {
      if (!dragging) orbit.enabled = false;
    };

    const onPointerDown = (event: PointerEvent) => {
      if (event.button === 0) {
        clearSelectionHighlight(viewer);
        selectedIndicesRef.current = [];
        hideOverlay();
        overlay.style.cssText = dragStyle;

        dragging = true;
        pointerId = event.pointerId;
        const bounds = canvasRect();
        startX = event.clientX - bounds.left;
        startY = event.clientY - bounds.top;
        orbit.enabled = false;
        canvas.setPointerCapture(event.pointerId);
        event.preventDefault();
        event.stopPropagation();
        return;
      }
      enableOrbitForButton(event.button);
    };

    const onPointerMove = (event: PointerEvent) => {
      if (!dragging || event.pointerId !== pointerId) return;
      const bounds = canvasRect();
      const x = event.clientX - bounds.left;
      const y = event.clientY - bounds.top;
      updateOverlay(startX, startY, x, y);
      event.preventDefault();
      event.stopPropagation();
    };

    const finishBoxSelect = (event: PointerEvent) => {
      if (!dragging || event.pointerId !== pointerId) return;
      dragging = false;
      pointerId = null;
      canvas.releasePointerCapture(event.pointerId);

      const bounds = canvasRect();
      const endX = event.clientX - bounds.left;
      const endY = event.clientY - bounds.top;
      const rect = rectFromPoints(startX, startY, endX, endY);

      const picked = splatIndicesInScreenRect(viewer, camera, canvas, rect);
      selectedIndicesRef.current = picked;

      if (picked.length > 0) {
        showSelectionHighlight(viewer, threeScene, picked);
        showSelectedOverlay(startX, startY, endX, endY, picked.length);
      } else {
        clearSelectionHighlight(viewer);
        hideOverlay();
      }

      orbit.enabled = false;
      requestViewerRender(viewer);
      event.preventDefault();
      event.stopPropagation();
    };

    const onPointerUp = (event: PointerEvent) => {
      if (dragging && event.pointerId === pointerId) {
        finishBoxSelect(event);
        return;
      }
      disableOrbitIfNeeded();
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Backspace" && event.key !== "Delete") return;
      const target = event.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable)
      ) {
        return;
      }

      const toDelete = [...selectedIndicesRef.current];
      if (toDelete.length === 0) return;

      const mesh = viewer.getSplatMesh();
      const total = mesh.getSplatCount();
      if (toDelete.length >= total * 0.98) return;

      event.preventDefault();
      clearSelectionHighlight(viewer);
      hideSplatIndices(viewer, toDelete);

      const existing = new Set(editRef.current.deletedSplatIndices ?? []);
      for (const index of toDelete) existing.add(index);
      onEditChange({ deletedSplatIndices: [...existing] });
      selectedIndicesRef.current = [];
      hideOverlay();
    };

    canvas.addEventListener("pointerdown", onPointerDown, true);
    canvas.addEventListener("pointermove", onPointerMove, true);
    canvas.addEventListener("pointerup", onPointerUp, true);
    canvas.addEventListener("pointercancel", onPointerUp, true);
    window.addEventListener("keydown", onKeyDown);

    return () => {
      canvas.removeEventListener("pointerdown", onPointerDown, true);
      canvas.removeEventListener("pointermove", onPointerMove, true);
      canvas.removeEventListener("pointerup", onPointerUp, true);
      canvas.removeEventListener("pointercancel", onPointerUp, true);
      window.removeEventListener("keydown", onKeyDown);
      overlay.remove();
      badge.remove();
      clearSelectionHighlight(viewer);
      orbit.enabled = true;
    };
  }, [handle, enabled, tool, onEditChange]);

  useEffect(() => {
    if (!enabled || !handle || tool === "select") return;

    const viewer = handle.getViewer();
    const canvas = getViewerCanvas(viewer);
    const orbit = (viewer as { controls?: ViewerOrbitControls }).controls;
    if (!canvas || !orbit) return;

    let pointerDown = false;

    const onPointerDown = (event: PointerEvent) => {
      if (event.button === 0 || event.button === 2) {
        pointerDown = true;
        orbit.enabled = true;
      }
    };

    const onPointerUp = () => {
      pointerDown = false;
      orbit.enabled = false;
    };

    canvas.addEventListener("pointerdown", onPointerDown, true);
    canvas.addEventListener("pointerup", onPointerUp, true);
    canvas.addEventListener("pointercancel", onPointerUp, true);

    return () => {
      canvas.removeEventListener("pointerdown", onPointerDown, true);
      canvas.removeEventListener("pointerup", onPointerUp, true);
      canvas.removeEventListener("pointercancel", onPointerUp, true);
      if (!pointerDown) orbit.enabled = false;
    };
  }, [handle, enabled, tool]);

  useEffect(() => {
    if (!enabled || !handle) {
      controlsRef.current?.dispose();
      controlsRef.current = null;
      return;
    }

    const viewer = handle.getViewer();
    const camera = handle.getCamera();
    const sceneObj = handle.getSplatScene();
    const canvas = getViewerCanvas(viewer);
    if (!camera || !sceneObj || !canvas) return;

    const threeScene = getViewerThreeScene(viewer, sceneObj);
    if (!threeScene) return;

    const orbit = (viewer as { controls?: ViewerOrbitControls }).controls;

    const controls = new TransformControls(camera, canvas);
    controlsRef.current = controls;

    const gizmoRoot = controls.getHelper();
    gizmoRootRef.current = gizmoRoot;
    styleGizmoOverlay(gizmoRoot);

    const cropGroup = new THREE.Group();
    cropGroupRef.current = cropGroup;

    const overlayScene = new THREE.Scene();
    overlayScene.add(gizmoRoot);
    overlayScene.add(cropGroup);
    const unmountOverlayRender = mountEditorOverlayRender(viewer, overlayScene);

    const cropBox = edit.crop ?? defaultCropFromScene(sceneObj);
    const size = new THREE.Vector3(
      cropBox.max[0] - cropBox.min[0],
      cropBox.max[1] - cropBox.min[1],
      cropBox.max[2] - cropBox.min[2]
    );
    const center = new THREE.Vector3(
      (cropBox.min[0] + cropBox.max[0]) / 2,
      (cropBox.min[1] + cropBox.max[1]) / 2,
      (cropBox.min[2] + cropBox.max[2]) / 2
    );

    const cropGeo = new THREE.BoxGeometry(size.x, size.y, size.z);
    const cropMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      wireframe: true,
      transparent: true,
      opacity: 0.85,
      depthTest: false,
    });
    const cropMesh = new THREE.Mesh(cropGeo, cropMat);
    cropMesh.position.copy(center);
    cropMeshRef.current = cropMesh;
    cropGroup.add(cropMesh);

    const syncCropFromMesh = () => {
      const half = new THREE.Vector3();
      cropMesh.geometry.computeBoundingBox();
      const geoBox = cropMesh.geometry.boundingBox;
      if (!geoBox) return;
      half.set(
        (geoBox.max.x - geoBox.min.x) / 2,
        (geoBox.max.y - geoBox.min.y) / 2,
        (geoBox.max.z - geoBox.min.z) / 2
      );
      half.multiply(cropMesh.scale);
      const c = cropMesh.position;
      onEditChange({
        crop: {
          min: [c.x - half.x, c.y - half.y, c.z - half.z],
          max: [c.x + half.x, c.y + half.y, c.z + half.z],
        },
      });
      requestViewerRender(viewer);
    };

    const onObjectChange = () => {
      if (tool === "crop" && controls.object === cropMesh) {
        syncCropFromMesh();
        return;
      }
      if (
        (tool === "move" || tool === "rotate" || tool === "scale") &&
        controls.object === sceneObj
      ) {
        onEditChange({ transform: readTransformFromObject(sceneObj) });
        styleGizmoOverlay(gizmoRoot);
        requestViewerRender(viewer);
      }
    };

    const onDraggingChanged = (event: { value: unknown }) => {
      if (!orbit) return;
      const draggingGizmo = Boolean(event.value);
      if (draggingGizmo) {
        orbit.enabled = false;
      } else if (tool !== "select") {
        orbit.enabled = false;
      }
    };

    const onGizmoPointerDown = () => {
      if (orbit) orbit.enabled = false;
    };

    const onGizmoPointerUp = () => {
      if (orbit && tool !== "select") orbit.enabled = false;
    };

    controls.addEventListener("objectChange", onObjectChange);
    controls.addEventListener("dragging-changed", onDraggingChanged);
    controls.addEventListener("mouseDown", onGizmoPointerDown);
    controls.addEventListener("mouseUp", onGizmoPointerUp);

    const applyTool = () => {
      cropGroup.visible = tool === "crop";
      if (tool === "crop") {
        controls.setMode("translate");
        controls.attach(cropMesh);
        controls.enabled = true;
        controls.showX = controls.showY = controls.showZ = true;
      } else if (tool === "move") {
        controls.setMode("translate");
        controls.attach(sceneObj);
        controls.enabled = true;
      } else if (tool === "rotate") {
        controls.setMode("rotate");
        controls.attach(sceneObj);
        controls.enabled = true;
      } else if (tool === "scale") {
        controls.setMode("scale");
        controls.size = 1.45;
        controls.attach(sceneObj);
        controls.enabled = true;
      } else {
        controls.size = 1;
        controls.detach();
        controls.enabled = false;
      }
      if (orbit) orbit.enabled = false;
      styleGizmoOverlay(gizmoRoot);
      requestViewerRender(viewer);
    };

    applyTransformToObject(sceneObj, edit.transform);
    applyTool();

    return () => {
      unmountOverlayRender();
      controls.removeEventListener("objectChange", onObjectChange);
      controls.removeEventListener("dragging-changed", onDraggingChanged);
      controls.removeEventListener("mouseDown", onGizmoPointerDown);
      controls.removeEventListener("mouseUp", onGizmoPointerUp);
      controls.detach();
      controls.dispose();
      overlayScene.remove(gizmoRoot);
      overlayScene.remove(cropGroup);
      cropGeo.dispose();
      cropMat.dispose();
      controlsRef.current = null;
      cropMeshRef.current = null;
      cropGroupRef.current = null;
      gizmoRootRef.current = null;
    };
  }, [handle, enabled, tool]);

  useEffect(() => {
    if (!handle || !enabled) return;
    const sceneObj = handle.getSplatScene();
    if (!sceneObj) return;
    applyTransformToObject(sceneObj, edit.transform);
    requestViewerRender(handle.getViewer());
  }, [handle, enabled, edit.transform]);
}
