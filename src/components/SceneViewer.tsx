"use client";

import { useCallback, useEffect, useState } from "react";
import {
  resolvePointCloudUrl,
  resolveSplatUrl,
} from "@/lib/demo-scenes";
import AlignGizmoToolbar from "@/components/AlignGizmoToolbar";
import ViewerErrorPanel from "@/components/ViewerErrorPanel";
import type { AholoModelFormat } from "@/lib/aholo/model-url";
import type {
  GizmoMode,
  SceneAlignmentState,
  SceneId,
  SceneTransform,
} from "@/lib/scene-alignment";
import dynamic from "next/dynamic";
import * as THREE from "three";
import ViewOrientationGizmo from "@/components/ViewOrientationGizmo";

const PointCloudSceneViewer = dynamic(
  () => import("@/components/PointCloudSceneViewer"),
  { ssr: false }
);

const TimelineSplatViewer = dynamic(
  () => import("@/components/TimelineSplatViewer"),
  { ssr: false }
);

const AholoSplatViewer = dynamic(
  () => import("@/components/AholoSplatViewer"),
  { ssr: false }
);

type Props = {
  primaryPointUrl: string;
  secondaryPointUrl: string;
  primarySplatUrl?: string;
  secondarySplatUrl?: string;
  blend: number;
  alignment: SceneAlignmentState;
  overlayBoth: boolean;
  alignGizmoActive?: boolean;
  editingScene?: SceneId;
  gizmoMode?: GizmoMode;
  onGizmoModeChange?: (mode: GizmoMode) => void;
  onGizmoTransformChange?: (id: SceneId, transform: SceneTransform) => void;
  onGizmoDragStart?: () => void;
  /** Aholo result — bypass desk assets and force splat viewer */
  aholoSplatUrl?: string | null;
  aholoModelFormat?: AholoModelFormat;
  sourceLabel?: string;
};

type ViewerMode = "loading" | "splat" | "points" | "error";

export default function SceneViewer({
  primaryPointUrl,
  secondaryPointUrl,
  primarySplatUrl,
  secondarySplatUrl,
  blend,
  alignment,
  overlayBoth,
  alignGizmoActive = false,
  editingScene = "desk2",
  gizmoMode = "rotate",
  onGizmoModeChange,
  onGizmoTransformChange,
  onGizmoDragStart,
  aholoSplatUrl = null,
  aholoModelFormat = "ply",
  sourceLabel,
}: Props) {
  const [mode, setMode] = useState<ViewerMode>("loading");
  const [primaryUrl, setPrimaryUrl] = useState(primaryPointUrl);
  const [secondaryUrl, setSecondaryUrl] = useState(secondaryPointUrl);
  const [splatHint, setSplatHint] = useState<string | null>(null);
  const [viewerError, setViewerError] = useState<string | null>(null);
  const [cameraQuaternion, setCameraQuaternion] =
    useState<THREE.Quaternion | null>(null);

  const handleCameraQuaternion = useCallback((q: THREE.Quaternion) => {
    setCameraQuaternion(q);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function resolve() {
      setViewerError(null);

      if (aholoSplatUrl) {
        setMode("splat");
        setPrimaryUrl(aholoSplatUrl);
        setSecondaryUrl(aholoSplatUrl);
        setSplatHint(null);
        return;
      }

      const [primarySplat, secondarySplat, primaryPoint, secondaryPoint] =
        await Promise.all([
          resolveSplatUrl(primarySplatUrl),
          resolveSplatUrl(secondarySplatUrl),
          resolvePointCloudUrl(primaryPointUrl),
          resolvePointCloudUrl(secondaryPointUrl),
        ]);

      if (cancelled) return;

      if (primarySplat && secondarySplat) {
        setMode("splat");
        setPrimaryUrl(primarySplat);
        setSecondaryUrl(secondarySplat);
        setSplatHint(null);
        return;
      }

      if (primaryPoint.missing && secondaryPoint.missing) {
        setMode("error");
        setViewerError(
          "No scene files found. Copy COLMAP output: " +
            "Copy-Item desk1\\dense\\0\\fused.ply public\\scenes\\desk1\\scene.ply -Force " +
            "(and the same for desk2)."
        );
        return;
      }

      setMode("points");
      setPrimaryUrl(primaryPoint.url);
      setSecondaryUrl(secondaryPoint.url);

      const hints: string[] = [];
      if (primaryPoint.fallback || secondaryPoint.fallback) {
        hints.push("Using desk3 sample — add desk1/desk2 scene.ply for your data");
      }
      if (primarySplat || secondarySplat) {
        hints.push("Export scene-splat.ply for both desks to enable splat mode");
      } else {
        hints.push("Align scenes to match desk1 and desk2");
      }
      setSplatHint(hints.join(" · "));
    }

    resolve();
    return () => {
      cancelled = true;
    };
  }, [
    primaryPointUrl,
    secondaryPointUrl,
    primarySplatUrl,
    secondarySplatUrl,
    aholoSplatUrl,
  ]);

  if (mode === "loading") {
    return (
      <div className="absolute inset-0 bg-zinc-950 flex items-center justify-center text-zinc-500 text-sm">
        Loading scene…
      </div>
    );
  }

  if (mode === "error" && viewerError) {
    return (
      <ViewerErrorPanel
        title="Scene not found"
        message={viewerError}
        hint="Or use Skip · view desk demo after copying scene files"
      />
    );
  }

  const viewerProps = {
    primaryUrl,
    secondaryUrl,
    blend,
    primaryTransform: alignment.desk1,
    secondaryTransform: alignment.desk2,
    overlayBoth,
  };

  return (
    <>
      <div className="absolute top-28 left-4 right-4 z-20 pointer-events-none space-y-1 max-w-md">
        <span
          className={`inline-block text-[10px] uppercase tracking-wider px-2 py-1 rounded-md border ${
            aholoSplatUrl
              ? "border-emerald-200/40 text-emerald-100/90 bg-emerald-950/40"
              : mode === "splat"
                ? "border-amber-200/40 text-amber-100/90 bg-amber-950/40"
                : "border-zinc-600 text-zinc-400 bg-black/50"
          }`}
        >
          {sourceLabel ??
            (aholoSplatUrl
              ? "Aholo reconstruction"
              : mode === "splat"
                ? "3D Gaussian splat"
                : "COLMAP point cloud")}
        </span>
        {splatHint && mode === "points" && (
          <p className="text-[10px] text-zinc-500 leading-snug">{splatHint}</p>
        )}
      </div>

      {mode === "splat" && aholoSplatUrl ? (
        <AholoSplatViewer
          key={`${aholoSplatUrl}-${aholoModelFormat}`}
          modelUrl={aholoSplatUrl}
          format={aholoModelFormat}
          onLoadError={setViewerError}
        />
      ) : mode === "splat" ? (
        <TimelineSplatViewer
          {...viewerProps}
          onLoadError={setViewerError}
        />
      ) : (
        <PointCloudSceneViewer
          {...viewerProps}
          onLoadError={setViewerError}
          onCameraQuaternion={handleCameraQuaternion}
          alignGizmoActive={alignGizmoActive}
          editingScene={editingScene}
          gizmoMode={gizmoMode}
          onGizmoTransformChange={onGizmoTransformChange}
          onGizmoDragStart={onGizmoDragStart}
        />
      )}

      {alignGizmoActive && mode === "points" && onGizmoModeChange && (
        <AlignGizmoToolbar
          mode={gizmoMode}
          onModeChange={onGizmoModeChange}
          editingLabel={editingScene}
        />
      )}

      {alignGizmoActive && mode === "splat" && (
        <p className="absolute top-28 right-4 z-30 max-w-[220px] text-[10px] text-amber-200/70 bg-black/70 border border-amber-200/20 rounded-lg px-3 py-2 pointer-events-none">
          Gumball works in point-cloud mode. Remove scene-splat.ply from one desk
          or use the panel sliders here.
        </p>
      )}

      {viewerError && mode !== "error" && (
        <ViewerErrorPanel
          title="Could not load scene"
          message={viewerError}
        />
      )}

      {mode === "points" && !viewerError && (
        <ViewOrientationGizmo cameraQuaternion={cameraQuaternion} />
      )}
    </>
  );
}
