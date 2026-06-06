"use client";

import { useEffect } from "react";
import {
  applySceneTransform,
  SCENE_IDS,
  type SceneAlignmentState,
  type SceneId,
} from "@/lib/scene-alignment";
import { requestViewerRender } from "@/lib/splat-viewer-api";

type SplatViewer = import("@mkkellogg/gaussian-splats-3d").Viewer;

type Params = {
  getViewerForScene: (id: SceneId) => SplatViewer | null;
  alignment: SceneAlignmentState;
  viewerEpoch: number;
};

/** Push saved alignment onto each desk splat scene (timeline + align). */
export function useApplySceneAlignment({
  getViewerForScene,
  alignment,
  viewerEpoch,
}: Params): void {
  useEffect(() => {
    for (const id of SCENE_IDS) {
      const viewer = getViewerForScene(id);
      if (!viewer) continue;
      const sceneObj = viewer.getSplatScene(0);
      if (!sceneObj) continue;
      applySceneTransform(sceneObj, alignment[id]);
      requestViewerRender(viewer);
    }
  }, [alignment, getViewerForScene, viewerEpoch]);
}
