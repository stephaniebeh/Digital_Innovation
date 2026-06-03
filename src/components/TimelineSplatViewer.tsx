"use client";

import { useEffect, useRef } from "react";
import type { SceneTransform } from "@/lib/scene-alignment";
import { clearViewerHost, safeDisposeViewer } from "@/lib/viewer-host";

type Props = {
  primaryUrl: string;
  secondaryUrl: string;
  blend: number;
  primaryTransform: SceneTransform;
  secondaryTransform: SceneTransform;
  overlayBoth?: boolean;
  onLoadError?: (message: string | null) => void;
};

function cssTransform(t: SceneTransform): string {
  const degY = (t.rotationY * 180) / Math.PI;
  const degX = (t.rotationX * 180) / Math.PI;
  const degZ = (t.rotationZ * 180) / Math.PI;
  const px = (v: number) => `${v * 120}px`;
  const sx = t.scale * t.flipX;
  const sy = t.scale * t.flipY;
  return [
    `translate3d(${px(t.x)}, ${px(t.y)}, ${px(t.z)})`,
    `rotateX(${degX}deg)`,
    `rotateY(${degY}deg)`,
    `rotateZ(${degZ}deg)`,
    `scale(${sx}, ${sy})`,
  ].join(" ");
}

export default function TimelineSplatViewer({
  primaryUrl,
  secondaryUrl,
  blend,
  primaryTransform,
  secondaryTransform,
  overlayBoth = false,
  onLoadError,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const blendRef = useRef(blend);
  const overlayRef = useRef(overlayBoth);
  const transformsRef = useRef({ primaryTransform, secondaryTransform });
  const onLoadErrorRef = useRef(onLoadError);
  onLoadErrorRef.current = onLoadError;

  blendRef.current = blend;
  overlayRef.current = overlayBoth;
  transformsRef.current = { primaryTransform, secondaryTransform };

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let cancelled = false;
    let primaryViewer: import("@mkkellogg/gaussian-splats-3d").Viewer | null =
      null;
    let secondaryViewer: import("@mkkellogg/gaussian-splats-3d").Viewer | null =
      null;

    clearViewerHost(container);

    const layerA = document.createElement("div");
    const layerB = document.createElement("div");
    layerA.className = "absolute inset-0 origin-center";
    layerB.className = "absolute inset-0 origin-center";
    container.appendChild(layerA);
    container.appendChild(layerB);

    async function loadLayer(
      el: HTMLDivElement,
      url: string
    ): Promise<import("@mkkellogg/gaussian-splats-3d").Viewer> {
      const { Viewer } = await import("@mkkellogg/gaussian-splats-3d");
      const viewer = new Viewer({
        rootElement: el,
        cameraUp: [0, 1, 0],
        initialCameraPosition: [0, 1.2, 3.5],
        initialCameraLookAt: [0, 0.4, 0],
      });
      await viewer.addSplatScene(url, {
        splatAlphaRemovalThreshold: 5,
        showLoadingUI: false,
      });
      viewer.start();
      return viewer;
    }

    async function init() {
      try {
        const [primary, secondary] = await Promise.all([
          loadLayer(layerA, primaryUrl),
          loadLayer(layerB, secondaryUrl),
        ]);

        if (cancelled) {
          safeDisposeViewer(primary);
          safeDisposeViewer(secondary);
          return;
        }

        primaryViewer = primary;
        secondaryViewer = secondary;
        syncLayerTransforms(layerA, layerB);
        applyBlend(layerA, layerB, blendRef.current, overlayRef.current);
        onLoadErrorRef.current?.(null);
      } catch (err) {
        console.error("Timeline splat viewer failed:", err);
        const msg =
          err instanceof Error
            ? err.message
            : `Failed to load splat (${primaryUrl})`;
        onLoadErrorRef.current?.(msg);
      }
    }

    init();

    return () => {
      cancelled = true;
      safeDisposeViewer(primaryViewer);
      safeDisposeViewer(secondaryViewer);
      clearViewerHost(container);
    };
  }, [primaryUrl, secondaryUrl]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container?.children[0] || !container?.children[1]) return;
    const layerA = container.children[0] as HTMLElement;
    const layerB = container.children[1] as HTMLElement;
    syncLayerTransforms(layerA, layerB);
    applyBlend(layerA, layerB, blend, overlayBoth);
  }, [blend, overlayBoth, primaryTransform, secondaryTransform]);

  function syncLayerTransforms(layerA: HTMLElement, layerB: HTMLElement) {
    const { primaryTransform: pt, secondaryTransform: st } =
      transformsRef.current;
    layerA.style.transform = cssTransform(pt);
    layerB.style.transform = cssTransform(st);
  }

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 bg-zinc-950"
      aria-label="3D memory space viewer"
    />
  );
}

function applyBlend(
  layerA: HTMLElement,
  layerB: HTMLElement,
  t: number,
  overlay: boolean
) {
  const clamped = Math.max(0, Math.min(1, t));

  if (overlay) {
    layerA.style.opacity = "0.5";
    layerB.style.opacity = "0.5";
    layerA.style.visibility = "visible";
    layerB.style.visibility = "visible";
    return;
  }

  if (clamped <= 0.04) {
    layerA.style.opacity = "1";
    layerB.style.opacity = "0";
    layerB.style.visibility = "hidden";
    return;
  }
  if (clamped >= 0.96) {
    layerA.style.opacity = "0";
    layerA.style.visibility = "hidden";
    layerB.style.opacity = "1";
    layerB.style.visibility = "visible";
    return;
  }
  layerA.style.visibility = "visible";
  layerB.style.visibility = "visible";
  layerA.style.opacity = String(1 - clamped);
  layerB.style.opacity = String(clamped);
}
