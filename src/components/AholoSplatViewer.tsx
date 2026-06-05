"use client";

import { useEffect, useRef, useState } from "react";
import type { AholoModelFormat } from "@/lib/aholo/model-url";
import { applySplatEdit, applySplatEditDeletes } from "@/lib/splat-editor/apply-edit";
import { resolveSplatEdit } from "@/lib/splat-editor/load-edit";
import {
  SPLAT_SCENE_LOAD_OPTIONS,
  SPLAT_VIEWER_OPTIONS,
} from "@/lib/splat-viewer-config";
import { autoFrameSplatViewer } from "@/lib/splat-viewer-utils";
import { configureSplatViewerOrbit } from "@/lib/viewer-controls";
import type { SplatViewerHandle } from "@/lib/splat-viewer-api";
import { requestViewerRender } from "@/lib/splat-viewer-api";
import {
  blurTimelineRangeIfFocused,
  clearViewerHost,
  syncViewerCanvasSize,
  teardownSplatViewer,
  waitForHostLayout,
} from "@/lib/viewer-host";

type Props = {
  modelUrl: string;
  format: AholoModelFormat;
  label?: string;
  onLoadError?: (message: string | null) => void;
  onEditorHandle?: (handle: SplatViewerHandle | null) => void;
};

export default function AholoSplatViewer({
  modelUrl,
  format,
  label = "Aholo reconstruction",
  onLoadError,
  onEditorHandle,
}: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<import("@mkkellogg/gaussian-splats-3d").Viewer | null>(
    null
  );
  const [loading, setLoading] = useState(true);
  const onLoadErrorRef = useRef(onLoadError);
  const onEditorHandleRef = useRef(onEditorHandle);
  onLoadErrorRef.current = onLoadError;
  onEditorHandleRef.current = onEditorHandle;

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    let viewer: import("@mkkellogg/gaussian-splats-3d").Viewer | null = null;
    let cancelled = false;

    clearViewerHost(host);
    setLoading(true);
    onLoadErrorRef.current?.(null);
    onEditorHandleRef.current?.(null);

    async function init() {
      const host = hostRef.current;
      if (!host) return;
      await waitForHostLayout(host);

      const { Viewer, SceneFormat, SceneRevealMode } = await import(
        "@mkkellogg/gaussian-splats-3d"
      );

      if (cancelled || !hostRef.current) return;

      const sceneFormat = format === "spz" ? SceneFormat.Spz : SceneFormat.Ply;

      viewer = new Viewer({
        rootElement: hostRef.current,
        ...SPLAT_VIEWER_OPTIONS,
        sceneRevealMode: SceneRevealMode.Instant,
      });
      viewerRef.current = viewer;

      await viewer.addSplatScene(modelUrl, {
        ...SPLAT_SCENE_LOAD_OPTIONS,
        format: sceneFormat,
      });

      if (cancelled) {
        teardownSplatViewer(viewer);
        viewer = null;
        viewerRef.current = null;
        return;
      }

      const sceneObj = viewer.getSplatScene(0);
      const savedEdit = await resolveSplatEdit(modelUrl);
      if (sceneObj && savedEdit) {
        applySplatEdit(viewer, sceneObj, savedEdit);
      }

      viewer.start();
      configureSplatViewerOrbit(viewer);
      if (savedEdit) {
        applySplatEditDeletes(viewer, savedEdit);
      }
      syncViewerCanvasSize(viewer, host);
      autoFrameSplatViewer(viewer, host);
      setLoading(false);
      onLoadErrorRef.current?.(null);

      onEditorHandleRef.current?.({
        sceneKey: modelUrl,
        label,
        getSplatScene: () => viewer?.getSplatScene(0) ?? null,
        getViewer: () => viewer!,
        getCamera: () => viewer?.camera ?? null,
        getHost: () => host,
        requestRender: () => viewer && requestViewerRender(viewer),
      });
    }

    init().catch((err) => {
      if (cancelled) return;
      console.error("Aholo splat viewer failed:", err);
      setLoading(false);
      const msg =
        err instanceof Error
          ? err.message
          : "Failed to load Aholo reconstruction";
      onLoadErrorRef.current?.(msg);
    });

    return () => {
      cancelled = true;
      onEditorHandleRef.current?.(null);
      teardownSplatViewer(viewer);
      viewer = null;
      viewerRef.current = null;
      clearViewerHost(host);
    };
  }, [modelUrl, format, label]);

  return (
    <div
      className="absolute inset-0 bg-zinc-950"
      onPointerDown={blurTimelineRangeIfFocused}
    >
      <div ref={hostRef} className="splat-viewer-layer absolute inset-0 w-full h-full" />
      {loading && (
        <p className="absolute inset-0 flex items-center justify-center text-sm text-zinc-500 pointer-events-none z-10">
          Loading 3D reconstruction…
        </p>
      )}
    </div>
  );
}
