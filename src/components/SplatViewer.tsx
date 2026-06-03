"use client";

import { useEffect, useRef } from "react";
import { clearViewerHost, safeDisposeViewer } from "@/lib/viewer-host";

type Props = {
  modelUrl: string;
};

export default function SplatViewer({ modelUrl }: Props) {
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    let viewer: import("@mkkellogg/gaussian-splats-3d").Viewer | null = null;
    let cancelled = false;
    clearViewerHost(host);

    async function init() {
      const { Viewer } = await import("@mkkellogg/gaussian-splats-3d");

      if (cancelled) return;

      viewer = new Viewer({
        rootElement: hostRef.current!,
        cameraUp: [0, 1, 0],
        initialCameraPosition: [0, 1.5, 4],
        initialCameraLookAt: [0, 0, 0],
      });

      await viewer.addSplatScene(modelUrl, {
        splatAlphaRemovalThreshold: 5,
        showLoadingUI: false,
      });

      if (!cancelled) {
        viewer.start();
      }
    }

    init().catch((err) => {
      console.error("Splat viewer failed:", err);
    });

    return () => {
      cancelled = true;
      safeDisposeViewer(viewer);
      clearViewerHost(host);
    };
  }, [modelUrl]);

  return (
    <div className="w-full h-[min(70vh,640px)] rounded-xl overflow-hidden border border-white/20 bg-zinc-900">
      <div ref={hostRef} className="w-full h-full" />
    </div>
  );
}
