"use client";

import { useEffect, useRef, useState } from "react";
import type { AholoModelFormat } from "@/lib/aholo/model-url";
import {
  SPLAT_SCENE_LOAD_OPTIONS,
  SPLAT_VIEWER_OPTIONS,
} from "@/lib/splat-viewer-config";
import {
  applyDeskLayerBlend,
  autoFrameSplatViewer,
} from "@/lib/splat-viewer-utils";
import {
  clearViewerHost,
  syncViewerCanvasSize,
  teardownSplatViewer,
  waitForHostLayout,
} from "@/lib/viewer-host";

type Props = {
  primaryUrl: string;
  secondaryUrl: string;
  primaryFormat: AholoModelFormat;
  secondaryFormat: AholoModelFormat;
  blend: number;
  overlayBoth?: boolean;
  onLoadError?: (message: string | null) => void;
};

type SplatViewer = import("@mkkellogg/gaussian-splats-3d").Viewer;

export default function TimelineSplatViewer({
  primaryUrl,
  secondaryUrl,
  primaryFormat,
  secondaryFormat,
  blend,
  overlayBoth = false,
  onLoadError,
}: Props) {
  const rootRef = useRef<HTMLDivElement>(null);
  const layerARef = useRef<HTMLDivElement>(null);
  const layerBRef = useRef<HTMLDivElement>(null);
  const viewerARef = useRef<SplatViewer | null>(null);
  const viewerBRef = useRef<SplatViewer | null>(null);
  const desk2LoadingRef = useRef(false);
  const initGenRef = useRef(0);
  const onLoadErrorRef = useRef(onLoadError);
  const [loadPhase, setLoadPhase] = useState<"loading" | "ready">("loading");
  const [desk2Ready, setDesk2Ready] = useState(false);
  const [statusLine, setStatusLine] = useState("Preparing viewer…");
  const [activeLabel, setActiveLabel] = useState("2020 · desk1");

  onLoadErrorRef.current = onLoadError;

  useEffect(() => {
    const root = rootRef.current;
    const layerA = layerARef.current;
    const layerB = layerBRef.current;
    if (!root || !layerA || !layerB) return;

    const gen = ++initGenRef.current;
    let cancelled = false;
    desk2LoadingRef.current = false;
    setDesk2Ready(false);

    clearViewerHost(layerA);
    clearViewerHost(layerB);
    viewerARef.current = null;
    viewerBRef.current = null;
    setLoadPhase("loading");
    setStatusLine("Preparing viewer…");
    onLoadErrorRef.current?.(null);

    async function createDeskViewer(
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

      viewer.start();
      syncViewerCanvasSize(viewer, host);
      autoFrameSplatViewer(viewer, host);
      return viewer;
    }

    async function loadDesk2(): Promise<void> {
      if (desk2LoadingRef.current || viewerBRef.current || cancelled) return;
      desk2LoadingRef.current = true;
      setStatusLine("Loading desk2 (2026)…");
      try {
        const viewerB = await createDeskViewer(
          layerB!,
          secondaryUrl,
          secondaryFormat
        );
        if (cancelled || gen !== initGenRef.current) {
          teardownSplatViewer(viewerB);
          return;
        }
        viewerBRef.current = viewerB;
        syncViewerCanvasSize(viewerB, layerB!);
        setDesk2Ready(true);
        setStatusLine("");
        applyDeskLayerBlend(layerA!, layerB!, blend, overlayBoth);
      } catch (err) {
        if (!cancelled && gen === initGenRef.current) {
          console.error("Desk2 splat load failed:", err);
        }
      } finally {
        desk2LoadingRef.current = false;
      }
    }

    async function init() {
      setStatusLine("Loading desk1 (2020)…");
      const viewerA = await createDeskViewer(layerA, primaryUrl, primaryFormat);
      if (cancelled || gen !== initGenRef.current) {
        teardownSplatViewer(viewerA);
        return;
      }
      viewerARef.current = viewerA;
      syncViewerCanvasSize(viewerA, layerA);
      autoFrameSplatViewer(viewerA, layerA);

      applyDeskLayerBlend(layerA, layerB, blend, overlayBoth);
      setActiveLabel(blend < 0.5 ? "2020 · desk1" : "2026 · desk2");
      setLoadPhase("ready");
      setStatusLine("");
      onLoadErrorRef.current?.(null);

      void loadDesk2();
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
      syncViewerCanvasSize(viewerARef.current, layerA);
      syncViewerCanvasSize(viewerBRef.current, layerB);
    };
    window.addEventListener("resize", onResize);

    return () => {
      cancelled = true;
      window.removeEventListener("resize", onResize);
      teardownSplatViewer(viewerARef.current);
      teardownSplatViewer(viewerBRef.current);
      viewerARef.current = null;
      viewerBRef.current = null;
      clearViewerHost(layerA);
      clearViewerHost(layerB);
    };
  }, [primaryUrl, secondaryUrl, primaryFormat, secondaryFormat]);

  useEffect(() => {
    const layerA = layerARef.current;
    const layerB = layerBRef.current;
    if (!layerA || !layerB || loadPhase !== "ready") return;

    if (!viewerBRef.current && blend >= 0.5 + 0.1) {
      setActiveLabel("2026 · desk2 (loading…)");
      return;
    }

    applyDeskLayerBlend(layerA, layerB, blend, overlayBoth);

    if (overlayBoth) {
      setActiveLabel("Overlay · desk1 + desk2");
    } else if (blend <= 0.5 - 0.1) {
      setActiveLabel("2020 · desk1");
      if (viewerARef.current) {
        syncViewerCanvasSize(viewerARef.current, layerA);
        autoFrameSplatViewer(viewerARef.current, layerA);
      }
    } else if (blend >= 0.5 + 0.1) {
      setActiveLabel(desk2Ready ? "2026 · desk2" : "2026 · desk2 (loading…)");
      if (viewerBRef.current) {
        syncViewerCanvasSize(viewerBRef.current, layerB);
        autoFrameSplatViewer(viewerBRef.current, layerB);
      }
    } else {
      setActiveLabel("Crossfade · desk1 → desk2");
    }
  }, [blend, overlayBoth, loadPhase, desk2Ready, secondaryUrl, secondaryFormat]);

  return (
    <div
      ref={rootRef}
      className="absolute inset-0 bg-zinc-950 splat-viewer-root"
      aria-label="3D memory space viewer"
    >
      <div
        ref={layerARef}
        className="splat-viewer-layer absolute inset-0 w-full h-full"
        aria-label="Desk1 2020 splat viewer"
      />
      <div
        ref={layerBRef}
        className="splat-viewer-layer absolute inset-0 w-full h-full"
        aria-label="Desk2 2026 splat viewer"
      />

      {loadPhase === "ready" && (
        <p className="absolute bottom-32 left-4 z-10 text-[10px] uppercase tracking-wider text-amber-200/80 pointer-events-none">
          {activeLabel}
        </p>
      )}

      {loadPhase === "loading" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 pointer-events-none z-20">
          <p className="text-sm text-zinc-400">{statusLine}</p>
          <p className="text-[10px] text-zinc-600 max-w-xs text-center">
            Loading desk1 first — desk2 loads in the background.
          </p>
        </div>
      )}
    </div>
  );
}
