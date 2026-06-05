"use client";

import { useEffect } from "react";
import { bindAlignCameraSync } from "@/lib/align-camera-sync";
import {
  SCENE_IDS,
  type AlignSceneVisibility,
  type SceneId,
} from "@/lib/scene-alignment";

type SplatViewer = import("@mkkellogg/gaussian-splats-3d").Viewer;

type Params = {
  getViewerForScene: (id: SceneId) => SplatViewer | null;
  editingScene: SceneId;
  alignSceneVisibility?: AlignSceneVisibility;
  enabled: boolean;
  viewerEpoch: number;
};

export function useAlignCameraSync({
  getViewerForScene,
  editingScene,
  alignSceneVisibility,
  enabled,
  viewerEpoch,
}: Params): void {
  useEffect(() => {
    if (!enabled) return;

    const visibleIds = SCENE_IDS.filter(
      (id) => alignSceneVisibility?.[id] !== false
    );
    const viewers = visibleIds
      .map((id) => getViewerForScene(id))
      .filter((v): v is SplatViewer => v !== null);

    if (viewers.length < 2) return;

    const leader =
      alignSceneVisibility?.[editingScene] !== false
        ? getViewerForScene(editingScene)
        : null;

    const leaderViewer = leader ?? viewers[0];
    if (!leaderViewer) return;

    return bindAlignCameraSync(leaderViewer, viewers);
  }, [
    enabled,
    editingScene,
    alignSceneVisibility,
    getViewerForScene,
    viewerEpoch,
  ]);
}
