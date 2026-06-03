"use client";

import { useEffect, useRef, useState } from "react";
import type { AholoModelFormat } from "@/lib/aholo/model-url";
import { clearViewerHost, safeDisposeViewer } from "@/lib/viewer-host";

type Props = {
  modelUrl: string;
  format: AholoModelFormat;
  onLoadError?: (message: string | null) => void;
};

export default function AholoSplatViewer({
  modelUrl,
  format,
  onLoadError,
}: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const onLoadErrorRef = useRef(onLoadError);
  onLoadErrorRef.current = onLoadError;

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    let viewer: import("@mkkellogg/gaussian-splats-3d").Viewer | null = null;
    let cancelled = false;

    clearViewerHost(host);
    setLoading(true);
    onLoadErrorRef.current?.(null);

    async function init() {
      const { Viewer, SceneFormat } = await import(
        "@mkkellogg/gaussian-splats-3d"
      );

      if (cancelled || !hostRef.current) return;

      const sceneFormat = format === "spz" ? SceneFormat.Spz : SceneFormat.Ply;

      viewer = new Viewer({
        rootElement: hostRef.current,
        cameraUp: [0, 1, 0],
        initialCameraPosition: [0, 1.5, 4],
        initialCameraLookAt: [0, 0.4, 0],
        sharedMemoryForWorkers: false,
      });

      await viewer.addSplatScene(modelUrl, {
        format: sceneFormat,
        splatAlphaRemovalThreshold: 5,
        showLoadingUI: false,
        progressiveLoad: true,
      });

      if (cancelled) {
        safeDisposeViewer(viewer);
        viewer = null;
        return;
      }

      viewer.start();
      setLoading(false);
      onLoadErrorRef.current?.(null);
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
      safeDisposeViewer(viewer);
      viewer = null;
      clearViewerHost(host);
    };
  }, [modelUrl, format]);

  return (
    <div className="absolute inset-0 bg-zinc-950">
      {/* React must not render children inside host — splat library owns that DOM */}
      <div ref={hostRef} className="absolute inset-0" />
      {loading && (
        <p className="absolute inset-0 flex items-center justify-center text-sm text-zinc-500 pointer-events-none z-10">
          Loading 3D reconstruction…
        </p>
      )}
    </div>
  );
}
