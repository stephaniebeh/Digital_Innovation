"use client";

import { useEffect } from "react";
import { bindLinkedViewerCameras } from "@/lib/align-camera-sync";

type SplatViewer = import("@mkkellogg/gaussian-splats-3d").Viewer;

type Params = {
  getViewers: () => SplatViewer[];
  enabled: boolean;
  viewerEpoch: number;
};

export function useTimelineCameraSync({
  getViewers,
  enabled,
  viewerEpoch,
}: Params): void {
  useEffect(() => {
    if (!enabled) return;
    const viewers = getViewers();
    if (viewers.length < 2) return;
    return bindLinkedViewerCameras(viewers);
  }, [enabled, getViewers, viewerEpoch]);
}
