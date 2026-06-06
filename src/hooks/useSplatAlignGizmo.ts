"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { TransformControls } from "three/examples/jsm/controls/TransformControls.js";
import {
  applySceneTransform,
  sceneTransformFromObject,
  type GizmoMode,
  type SceneId,
  type SceneAlignmentState,
  type SceneTransform,
} from "@/lib/scene-alignment";
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

type SplatViewer = import("@mkkellogg/gaussian-splats-3d").Viewer;

type Params = {
  getViewerForScene: (id: SceneId) => SplatViewer | null;
  alignment: SceneAlignmentState;
  enabled: boolean;
  editingScene: SceneId;
  gizmoMode: GizmoMode;
  onTransformPatch: (id: SceneId, transform: SceneTransform) => void;
  onDragStart: () => void;
  viewerEpoch: number;
};

export function useSplatAlignGizmo({
  getViewerForScene,
  alignment,
  enabled,
  editingScene,
  gizmoMode,
  onTransformPatch,
  onDragStart,
  viewerEpoch,
}: Params): void {
  const controlsRef = useRef<TransformControls | null>(null);
  const alignmentRef = useRef(alignment);
  alignmentRef.current = alignment;

  useEffect(() => {
    if (!enabled) {
      controlsRef.current?.dispose();
      controlsRef.current = null;
      return;
    }

    const viewer = getViewerForScene(editingScene);
    if (!viewer) return;

    const sceneObj = viewer.getSplatScene(0);
    const camera = viewer.camera;
    const canvas = getViewerCanvas(viewer);
    if (!sceneObj || !camera || !canvas) return;

    const threeScene = getViewerThreeScene(viewer, sceneObj);
    if (!threeScene) return;

    const orbit = (viewer as { controls?: ViewerOrbitControls }).controls;
    applySceneTransform(sceneObj, alignmentRef.current[editingScene]);

    const controls = new TransformControls(camera, canvas);
    controlsRef.current = controls;
    const gizmoRoot = controls.getHelper();
    styleGizmoOverlay(gizmoRoot);
    if (gizmoMode === "scale") controls.size = 1.45;

    const overlayScene = new THREE.Scene();
    overlayScene.add(gizmoRoot);
    const unmountOverlayRender = mountEditorOverlayRender(viewer, overlayScene);

    controls.setMode(gizmoMode);
    controls.attach(sceneObj);

    const onObjectChange = () => {
      onTransformPatch(editingScene, sceneTransformFromObject(sceneObj));
      requestViewerRender(viewer);
    };

    const onMouseDown = () => {
      onDragStart();
      if (orbit) orbit.enabled = false;
    };

    const onMouseUp = () => {
      if (orbit) orbit.enabled = true;
    };

    const onDraggingChanged = (event: { value: unknown }) => {
      if (orbit) orbit.enabled = !Boolean(event.value);
    };

    controls.addEventListener("objectChange", onObjectChange);
    controls.addEventListener("mouseDown", onMouseDown);
    controls.addEventListener("mouseUp", onMouseUp);
    controls.addEventListener("dragging-changed", onDraggingChanged);

    return () => {
      unmountOverlayRender();
      controls.removeEventListener("objectChange", onObjectChange);
      controls.removeEventListener("mouseDown", onMouseDown);
      controls.removeEventListener("mouseUp", onMouseUp);
      controls.removeEventListener("dragging-changed", onDraggingChanged);
      controls.detach();
      controls.dispose();
      overlayScene.remove(gizmoRoot);
      controlsRef.current = null;
      if (orbit) orbit.enabled = true;
    };
  }, [
    enabled,
    editingScene,
    gizmoMode,
    getViewerForScene,
    viewerEpoch,
    onTransformPatch,
    onDragStart,
  ]);

  useEffect(() => {
    if (!enabled) return;
    const controls = controlsRef.current;
    if (!controls) return;
    controls.setMode(gizmoMode);
    controls.size = gizmoMode === "scale" ? 1.45 : 1;
    const helper = controls.getHelper();
    styleGizmoOverlay(helper);
  }, [gizmoMode, enabled]);
}
