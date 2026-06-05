"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSplatAlignGizmo } from "@/hooks/useSplatAlignGizmo";
import {
  defaultSplatAlignment,
  type AlignSceneVisibility,
  type GizmoMode,
  type SceneAlignmentState,
  type SceneId,
  type SceneTransform,
} from "@/lib/scene-alignment";
import type { AholoModelFormat } from "@/lib/aholo/model-url";
import { timelineLabelAtPosition } from "@/lib/demo-scenes";
import {
  SPLAT_SCENE_LOAD_OPTIONS,
  SPLAT_VIEWER_OPTIONS,
} from "@/lib/splat-viewer-config";
import {
  applyAlignLayerVisibility,
  applyTimelineLayerBlend,
  autoFrameSplatViewer,
} from "@/lib/splat-viewer-utils";
import { applySplatEdit, applySplatEditDeletes } from "@/lib/splat-editor/apply-edit";
import { resolveSplatEdit } from "@/lib/splat-editor/load-edit";
import type { SplatViewerHandle } from "@/lib/splat-viewer-api";
import { requestViewerRender } from "@/lib/splat-viewer-api";
import {
  blurTimelineRangeIfFocused,
  clearViewerHost,
  syncViewerCanvasSize,
  teardownSplatViewer,
  waitForHostLayout,
} from "@/lib/viewer-host";
import { configureSplatViewerOrbit } from "@/lib/viewer-controls";

export type TimelineSplatLayer = {
  id: string;
  url: string | null;
  format: AholoModelFormat;
  missing?: boolean;
};

type Props = {
  layers: TimelineSplatLayer[];
  timelinePos: number;
  overlayAll?: boolean;
  alignMode?: boolean;
  alignment?: SceneAlignmentState;
  alignSceneVisibility?: AlignSceneVisibility;
  editingScene?: SceneId;
  gizmoMode?: GizmoMode;
  onAlignTransformPatch?: (id: SceneId, transform: SceneTransform) => void;
  onAlignDragStart?: () => void;
  onLoadError?: (message: string | null) => void;
  onEditorHandle?: (handle: SplatViewerHandle | null) => void;
};

type SplatViewer = import("@mkkellogg/gaussian-splats-3d").Viewer;

export default function TimelineSplatViewer({
  layers,
  timelinePos,
  overlayAll = false,
  alignMode = false,
  alignment,
  alignSceneVisibility,
  editingScene = "desk2",
  gizmoMode = "translate",
  onAlignTransformPatch,
  onAlignDragStart,
  onLoadError,
  onEditorHandle,
}: Props) {
  const rootRef = useRef<HTMLDivElement>(null);
  const layerHostsRef = useRef<(HTMLDivElement | null)[]>([]);
  const viewersRef = useRef<(SplatViewer | null)[]>([]);
  const loadingRef = useRef<Set<number>>(new Set());
  const initGenRef = useRef(0);
  const onLoadErrorRef = useRef(onLoadError);
  const onEditorHandleRef = useRef(onEditorHandle);
  onEditorHandleRef.current = onEditorHandle;
  const [loadPhase, setLoadPhase] = useState<"loading" | "ready">("loading");
  const [loadedCount, setLoadedCount] = useState(0);
  const [statusLine, setStatusLine] = useState("Preparing viewer…");
  const [activeLabel, setActiveLabel] = useState("");

  onLoadErrorRef.current = onLoadError;

  const layerKey = layers.map((l) => `${l.id}:${l.url ?? "missing"}`).join("|");

  const getViewerForScene = useCallback(
    (id: SceneId): SplatViewer | null => {
      const index = layers.findIndex((l) => l.id === id);
      if (index < 0) return null;
      return viewersRef.current[index] ?? null;
    },
    [layers, loadedCount]
  );

  useSplatAlignGizmo({
    getViewerForScene,
    alignment: alignment ?? defaultSplatAlignment(),
    enabled: alignMode && !!onAlignTransformPatch,
    editingScene,
    gizmoMode,
    onTransformPatch: onAlignTransformPatch ?? (() => {}),
    onDragStart: onAlignDragStart ?? (() => {}),
    viewerEpoch: loadedCount,
  });

  useEffect(() => {
    const root = rootRef.current;
    const hosts = layerHostsRef.current;
    if (!root || layers.length === 0) return;

    const gen = ++initGenRef.current;
    let cancelled = false;
    loadingRef.current = new Set();
    viewersRef.current = new Array(layers.length).fill(null);
    setLoadedCount(0);
    setLoadPhase("loading");
    setStatusLine("Preparing viewer…");
    onLoadErrorRef.current?.(null);
    onEditorHandleRef.current?.(null);

    for (const host of hosts) {
      if (host) clearViewerHost(host);
    }

    async function createViewer(
      host: HTMLDivElement,
      url: string,
      format: AholoModelFormat
    ): Promise<SplatViewer> {
      await waitForHostLayout(host);
      await waitForHostLayout(root!);

      const { Viewer, SceneFormat, SceneRevealMode } = await import(
        "@mkkellogg/gaussian-splats-3d"
      );

      const viewer = new Viewer({
        rootElement: host,
        ...SPLAT_VIEWER_OPTIONS,
        sceneRevealMode: SceneRevealMode.Instant,
      });

      await viewer.addSplatScene(url, {
        ...SPLAT_SCENE_LOAD_OPTIONS,
        format: format === "spz" ? SceneFormat.Spz : SceneFormat.Ply,
      });

      const sceneObj = viewer.getSplatScene(0);
      const savedEdit = await resolveSplatEdit(url);
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
      return viewer;
    }

    async function loadLayer(index: number): Promise<void> {
      if (cancelled || loadingRef.current.has(index)) return;
      if (viewersRef.current[index]) return;

      const host = hosts[index];
      const layer = layers[index];
      if (!host || !layer || !layer.url || layer.missing) return;

      loadingRef.current.add(index);
      setStatusLine(`Loading ${layer.id}…`);

      try {
        const viewer = await createViewer(host, layer.url, layer.format);
        if (cancelled || gen !== initGenRef.current) {
          teardownSplatViewer(viewer);
          return;
        }
        viewersRef.current[index] = viewer;
        syncViewerCanvasSize(viewer, host);
        setLoadedCount((c) => c + 1);

        const visibleHosts = hosts.filter(Boolean) as HTMLElement[];
        applyTimelineLayerBlend(visibleHosts, timelinePos, overlayAll);
        setActiveLabel(timelineLabelAtPosition(timelinePos, overlayAll));
      } catch (err) {
        if (!cancelled && gen === initGenRef.current) {
          console.error(`${layer.id} splat load failed:`, err);
          onLoadErrorRef.current?.(
            err instanceof Error ? err.message : `Failed to load ${layer.id}`
          );
        }
      } finally {
        loadingRef.current.delete(index);
      }
    }

    async function init() {
      const indicesToLoad = layers
        .map((layer, index) => ({ layer, index }))
        .filter(({ layer }) => layer.url && !layer.missing)
        .map(({ index }) => index);

      if (indicesToLoad.length === 0) return;

      // Load every desk in parallel so crossfades work while scrubbing.
      const loadPromises = indicesToLoad.map((index) => loadLayer(index));
      await loadPromises[0];
      if (cancelled || gen !== initGenRef.current) return;

      setLoadPhase("ready");
      setStatusLine(
        indicesToLoad.length > 1 ? "Loading remaining scenes…" : ""
      );
      onLoadErrorRef.current?.(null);
      setActiveLabel(timelineLabelAtPosition(timelinePos, overlayAll));

      await Promise.all(loadPromises);
      if (cancelled || gen !== initGenRef.current) return;
      setStatusLine("");
    }

    init().catch((err) => {
      if (cancelled || gen !== initGenRef.current) return;
      console.error("Timeline splat viewer failed:", err);
      onLoadErrorRef.current?.(
        err instanceof Error ? err.message : "Failed to load splat scenes"
      );
      setStatusLine("");
    });

    const onResize = () => {
      for (let i = 0; i < layers.length; i++) {
        const host = hosts[i];
        const viewer = viewersRef.current[i];
        if (host && viewer) syncViewerCanvasSize(viewer, host);
      }
    };
    window.addEventListener("resize", onResize);

    return () => {
      cancelled = true;
      onEditorHandleRef.current?.(null);
      window.removeEventListener("resize", onResize);
      for (const viewer of viewersRef.current) {
        teardownSplatViewer(viewer);
      }
      viewersRef.current = [];
      for (const host of hosts) {
        if (host) clearViewerHost(host);
      }
    };
  }, [layerKey]);

  useEffect(() => {
    if (loadPhase !== "ready") return;
    const hosts = layerHostsRef.current.filter(Boolean) as HTMLElement[];
    const layerIds = layers.map((l) => l.id);

    if (alignMode && alignSceneVisibility) {
      applyAlignLayerVisibility(hosts, layerIds, alignSceneVisibility);
      const visible = layerIds.filter((id) => alignSceneVisibility[id as SceneId]);
      setActiveLabel(
        visible.length > 0 ? `Align · ${visible.join(" + ")}` : "Align · no scenes visible"
      );
    } else {
      applyTimelineLayerBlend(hosts, timelinePos, overlayAll);
      setActiveLabel(timelineLabelAtPosition(timelinePos, overlayAll));
      for (let i = 0; i < viewersRef.current.length; i++) {
        const viewer = viewersRef.current[i];
        const host = hosts[i];
        if (!viewer || !host) continue;
        const opacity = Number.parseFloat(host.style.opacity);
        if (opacity > 0.001) requestViewerRender(viewer);
      }
    }

    if (alignMode) {
      onEditorHandleRef.current?.(null);
      return;
    }

    const n = layers.length;
    if (n <= 1) return;
    const pos = timelinePos * (n - 1);
    const focusIndex = Math.round(pos);

    const host = layerHostsRef.current[focusIndex];
    const viewer = viewersRef.current[focusIndex];
    const layer = layers[focusIndex];

    if (host && viewer && layer?.url && !layer.missing) {
      syncViewerCanvasSize(viewer, host);
      autoFrameSplatViewer(viewer, host);
      onEditorHandleRef.current?.({
        sceneKey: layer.url,
        label: layer.id,
        getSplatScene: () => viewer.getSplatScene(0),
        getViewer: () => viewer,
        getCamera: () => viewer.camera ?? null,
        getHost: () => host,
        requestRender: () => requestViewerRender(viewer),
      });
    } else {
      onEditorHandleRef.current?.(null);
    }
  }, [
    timelinePos,
    overlayAll,
    alignMode,
    alignSceneVisibility,
    loadPhase,
    layers,
    loadedCount,
  ]);

  return (
    <div
      ref={rootRef}
      className="absolute inset-0 bg-zinc-950 splat-viewer-root"
      aria-label="3D memory space viewer"
      onPointerDown={blurTimelineRangeIfFocused}
    >
      {layers.map((layer, i) => (
        <div
          key={layer.id}
          ref={(el) => {
            layerHostsRef.current[i] = el;
          }}
          className="splat-viewer-layer absolute inset-0 w-full h-full"
          aria-label={`${layer.id} splat viewer`}
        >
          {layer.missing && (
            <div className="absolute inset-0 flex items-center justify-center bg-zinc-950 pointer-events-none z-10">
              <p className="text-sm text-zinc-400 text-center px-6 max-w-sm">
                <span className="text-amber-200/90">{layer.id}</span> splat not
                on disk yet — run{" "}
                <code className="text-zinc-300">npm run bake-splat:{layer.id}</code>{" "}
                or wait for the bake to finish, then hard-refresh.
              </p>
            </div>
          )}
        </div>
      ))}

      {loadPhase === "ready" && (
        <p className="absolute bottom-32 left-4 z-10 text-[10px] uppercase tracking-wider text-amber-200/80 pointer-events-none">
          {activeLabel}
        </p>
      )}

      {loadPhase === "loading" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 pointer-events-none z-20">
          <p className="text-sm text-zinc-400">{statusLine}</p>
          <p className="text-[10px] text-zinc-600 max-w-xs text-center">
            Loading {layers[0]?.id ?? "scene"} first — other desks load in the
            background.
          </p>
        </div>
      )}
    </div>
  );
}
