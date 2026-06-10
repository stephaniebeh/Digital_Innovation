"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState } from "react";
import FloatingAddButton from "@/components/FloatingAddButton";
import LandingPage from "@/components/LandingPage";
import PrivateHubPage from "@/components/PrivateHubPage";
import PrivateRoomViewer from "@/components/PrivateRoomViewer";
import PublicMapPage from "@/components/PublicMapPage";
import PublicPlacePlaceholder from "@/components/PublicPlacePlaceholder";
import PublicPlaceViewer from "@/components/PublicPlaceViewer";
import ReconstructionLoader from "@/components/ReconstructionLoader";
import SplatEditorPanel from "@/components/SplatEditorPanel";
import UploadPhotosPage from "@/components/UploadPhotosPage";
import { useAlignmentHistory } from "@/hooks/useAlignmentHistory";
import {
  MIN_RECONSTRUCTION_IMAGES,
  openExistingWorld,
  startReconstruction,
} from "@/lib/aholo/client";
import type { AholoModelFormat } from "@/lib/aholo/model-url";
import { resolveAlignment } from "@/lib/alignment-persistence";
import { imageFilesFromFileList } from "@/lib/image-file-picker";
import {
  placeById,
  type PublicPlace,
} from "@/lib/public-places";
import {
  placeHas3DViewer,
  timelineForPlace,
} from "@/lib/public-place-scenes";
import {
  defaultAlignSceneVisibility,
  defaultSplatAlignment,
  type AlignSceneVisibility,
  type GizmoMode,
  type SceneId,
  type SceneTransform,
} from "@/lib/scene-alignment";
import type { SplatViewerHandle } from "@/lib/splat-viewer-api";

const SceneViewer = dynamic(() => import("@/components/SceneViewer"), {
  ssr: false,
});

type Phase =
  | "landing"
  | "public-map"
  | "public-place"
  | "private-hub"
  | "upload"
  | "loading"
  | "private-room"
  | "reconstruction";

type UploadOrigin = "public" | "private";

function stageIndexForStatus(status: string | null, uploading: boolean): number {
  if (uploading) return 1;
  switch (status) {
    case "PENDING":
      return 2;
    case "RUNNING":
      return 2;
    case "SUCCEEDED":
      return 3;
    default:
      return 0;
  }
}

function friendlyStatus(status: string): string {
  switch (status) {
    case "PENDING":
      return "Waiting in queue…";
    case "RUNNING":
      return "Building your memory…";
    case "SUCCEEDED":
      return "Almost ready…";
    default:
      if (status.toLowerCase().includes("upload")) return "Uploading photos…";
      return "Processing…";
  }
}

export default function Home() {
  const [phase, setPhase] = useState<Phase>("landing");
  const [uploadOrigin, setUploadOrigin] = useState<UploadOrigin>("public");
  const [publicTimelinePos, setPublicTimelinePos] = useState(0.66);
  const [privateTimelinePos, setPrivateTimelinePos] = useState(0);
  const [selectedPlaceId, setSelectedPlaceId] = useState<string | null>(null);
  const [placeTimelinePos, setPlaceTimelinePos] = useState(0);

  const [selectedImages, setSelectedImages] = useState<File[]>([]);
  const [loadStage, setLoadStage] = useState(0);
  const [loadProgress, setLoadProgress] = useState(0);
  const [loadStatusLine, setLoadStatusLine] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [aholoSplatUrl, setAholoSplatUrl] = useState<string | null>(null);
  const [aholoModelFormat, setAholoModelFormat] =
    useState<AholoModelFormat>("ply");
  const [hotspotOpen, setHotspotOpen] = useState(false);
  const [alignOpen, setAlignOpen] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editorHandle, setEditorHandle] = useState<SplatViewerHandle | null>(
    null
  );
  const [alignSceneVisibility, setAlignSceneVisibility] =
    useState<AlignSceneVisibility>(defaultAlignSceneVisibility);
  const [editingScene, setEditingScene] = useState<SceneId>("desk2");
  const [gizmoMode, setGizmoMode] = useState<GizmoMode>("translate");
  const pollAbortRef = useRef(false);

  const {
    alignment,
    changeAlignment,
    setAlignmentSilent,
    beginGizmoDrag,
    undo: undoAlignment,
    canUndo,
  } = useAlignmentHistory(defaultSplatAlignment());

  useEffect(() => {
    if (phase !== "private-room") return;
    let cancelled = false;
    resolveAlignment().then((resolved) => {
      if (!cancelled) setAlignmentSilent(resolved);
    });
    return () => {
      cancelled = true;
    };
  }, [phase, setAlignmentSilent]);

  const patchAlignTransform = useCallback(
    (id: SceneId, transform: SceneTransform) => {
      setAlignmentSilent((prev) => ({ ...prev, [id]: transform }));
    },
    [setAlignmentSilent]
  );

  const setSceneVisible = useCallback((id: SceneId, visible: boolean) => {
    setAlignSceneVisibility((prev) => ({ ...prev, [id]: visible }));
  }, []);

  const fileCount = selectedImages.length;
  const hasEnoughImages = fileCount >= MIN_RECONSTRUCTION_IMAGES;
  const imagesNeeded = Math.max(0, MIN_RECONSTRUCTION_IMAGES - fileCount);

  const applyPickedImages = useCallback((list: FileList | null) => {
    setSelectedImages(imageFilesFromFileList(list));
    setLoadError(null);
  }, []);

  const goLanding = useCallback(() => {
    pollAbortRef.current = true;
    setPhase("landing");
    setLoadError(null);
    setLoadStatusLine(null);
    setHotspotOpen(false);
  }, []);

  const goUpload = useCallback((from: UploadOrigin) => {
    setUploadOrigin(from);
    setLoadError(null);
    setPhase("upload");
  }, []);

  const enterPrivateRoom = useCallback(() => {
    pollAbortRef.current = true;
    setAholoSplatUrl(null);
    setLoadError(null);
    setPrivateTimelinePos(0);
    setHotspotOpen(false);
    setAlignOpen(false);
    setEditorOpen(false);
    setEditorHandle(null);
    setPhase("private-room");
  }, []);

  const uploadBack = useCallback(() => {
    setPhase(uploadOrigin === "private" ? "private-hub" : "public-map");
  }, [uploadOrigin]);

  const selectedPlace: PublicPlace | undefined = selectedPlaceId
    ? placeById(selectedPlaceId)
    : undefined;
  const selectedPlaceTimeline = selectedPlace
    ? timelineForPlace(selectedPlace.id)
    : null;

  const startRealReconstruction = useCallback(async () => {
    if (!selectedImages.length) {
      setLoadError("Select photos first.");
      return;
    }
    if (!hasEnoughImages) {
      setLoadError(
        `Select at least ${MIN_RECONSTRUCTION_IMAGES} photos (${imagesNeeded} more needed).`
      );
      return;
    }

    pollAbortRef.current = false;
    setLoadError(null);
    setLoadStatusLine(null);
    setEditorOpen(false);
    setEditorHandle(null);
    setPhase("loading");
    setLoadStage(0);
    setLoadProgress(0.05);

    try {
      setLoadStatusLine("Uploading your photos…");
      setLoadProgress(0.15);

      const { worldId, imageCount } = await startReconstruction(selectedImages, {
        name: "Afterimage capture",
        scene: "space",
        taskQuality: "high",
      });

      if (pollAbortRef.current) return;

      setLoadProgress(0.35);
      setLoadStatusLine(`${imageCount} photos received`);

      const { proxiedUrl, format } = await openExistingWorld(worldId, {
        shouldAbort: () => pollAbortRef.current,
        onStatus: (status) => {
          setLoadStatusLine(friendlyStatus(status));
          setLoadStage(stageIndexForStatus(status, false));
          if (status === "PENDING") setLoadProgress(0.45);
          else if (status === "RUNNING") setLoadProgress(0.65);
          else if (status === "SUCCEEDED") setLoadProgress(0.95);
        },
      });
      setAholoModelFormat(format);
      setAholoSplatUrl(proxiedUrl);
      setLoadProgress(1);
      setLoadStage(3);
      setPhase("reconstruction");
    } catch (err) {
      if (pollAbortRef.current) return;
      const message =
        err instanceof Error ? err.message : "Something went wrong";
      setLoadError(
        message.includes("AHOLO") || message.includes("API")
          ? "We couldn't process your photos right now. Please try again later."
          : message
      );
      setLoadProgress(0);
    }
  }, [selectedImages, hasEnoughImages, imagesNeeded]);

  const showFab =
    phase === "public-map" ||
    phase === "public-place" ||
    phase === "private-hub" ||
    phase === "private-room" ||
    phase === "reconstruction";

  const fabOrigin: UploadOrigin =
    phase === "private-hub" || phase === "private-room"
      ? "private"
      : "public";

  const reconstructionBack = useCallback(() => {
    setEditorOpen(false);
    setEditorHandle(null);
    setPhase(uploadOrigin === "private" ? "private-hub" : "public-map");
  }, [uploadOrigin]);

  return (
    <div className="min-h-screen bg-black text-white flex flex-col">
      {phase === "landing" && (
        <LandingPage
          onPublic={() => setPhase("public-map")}
          onPrivate={() => setPhase("private-hub")}
        />
      )}

      {phase === "public-map" && (
        <PublicMapPage
          timelinePos={publicTimelinePos}
          onTimelineChange={setPublicTimelinePos}
          onSelectPlace={(place) => {
            setSelectedPlaceId(place.id);
            setPlaceTimelinePos(0);
            setPhase("public-place");
          }}
          onBack={goLanding}
        />
      )}

      {phase === "public-place" && selectedPlace && (
        placeHas3DViewer(selectedPlace.id) && selectedPlaceTimeline ? (
          <PublicPlaceViewer
            place={selectedPlace}
            timelineMoments={selectedPlaceTimeline.moments}
            timelineYears={selectedPlaceTimeline.years}
            timelinePos={placeTimelinePos}
            onTimelineChange={setPlaceTimelinePos}
            onBack={() => setPhase("public-map")}
          />
        ) : (
          <PublicPlacePlaceholder
            place={selectedPlace}
            onBack={() => setPhase("public-map")}
          />
        )
      )}

      {phase === "private-hub" && (
        <PrivateHubPage
          onMyRoom={enterPrivateRoom}
          onAddSpace={() => goUpload("private")}
          onBack={goLanding}
        />
      )}

      {phase === "upload" && (
        <UploadPhotosPage
          fileCount={fileCount}
          minPhotos={MIN_RECONSTRUCTION_IMAGES}
          hasEnough={hasEnoughImages}
          error={loadError}
          onPickFiles={applyPickedImages}
          onStart={() => void startRealReconstruction()}
          onBack={uploadBack}
        />
      )}

      {phase === "loading" && (
        <main className="flex-1 flex items-center justify-center relative">
          <ReconstructionLoader
            stageIndex={loadStage}
            progress={loadProgress}
            statusLine={loadStatusLine}
            error={loadError}
          />
          {loadError && (
            <div className="absolute bottom-20 left-1/2 -translate-x-1/2 flex gap-2 pointer-events-auto z-50">
              <button
                type="button"
                onClick={() => {
                  setLoadError(null);
                  setPhase("upload");
                }}
                className="text-xs px-3 py-2 rounded-lg border border-white/15 text-zinc-400 hover:text-white"
              >
                Back
              </button>
              <button
                type="button"
                onClick={() => void startRealReconstruction()}
                className="text-xs px-3 py-2 rounded-lg border border-amber-200/30 text-amber-100 hover:bg-amber-950/50"
              >
                Try again
              </button>
            </div>
          )}
        </main>
      )}

      {phase === "private-room" && (
        <PrivateRoomViewer
          timelinePos={privateTimelinePos}
          onTimelineChange={setPrivateTimelinePos}
          alignment={alignment}
          onAlignmentChange={changeAlignment}
          alignOpen={alignOpen}
          onAlignOpenChange={setAlignOpen}
          editorOpen={editorOpen}
          onEditorOpenChange={setEditorOpen}
          alignSceneVisibility={alignSceneVisibility}
          onSceneVisibilityChange={setSceneVisible}
          editingScene={editingScene}
          onEditingSceneChange={setEditingScene}
          gizmoMode={gizmoMode}
          onGizmoModeChange={setGizmoMode}
          editorHandle={editorHandle}
          onAlignTransformPatch={patchAlignTransform}
          onAlignDragStart={beginGizmoDrag}
          onEditorHandle={setEditorHandle}
          canUndo={canUndo}
          onUndo={undoAlignment}
          onBack={() => setPhase("private-hub")}
          hotspotOpen={hotspotOpen}
          onHotspotToggle={() => setHotspotOpen((o) => !o)}
        />
      )}

      {phase === "reconstruction" && aholoSplatUrl && (
        <main className="flex-1 flex flex-col relative min-h-0 h-[100dvh]">
          <div className="absolute inset-0">
            <SceneViewer
              timelineMoments={[]}
              timelinePos={0}
              aholoSplatUrl={aholoSplatUrl}
              aholoModelFormat={aholoModelFormat}
              aholoLabel="Your memory"
              alignment={alignment}
              overlayBoth={false}
              onEditorHandle={setEditorHandle}
            />
            <SplatEditorPanel
              open={editorOpen}
              onOpenChange={setEditorOpen}
              handle={editorHandle}
            />
          </div>
          <div className="absolute top-0 left-0 right-0 p-4 flex justify-between items-start pointer-events-none z-20">
            <div className="pointer-events-auto flex flex-col gap-2">
              <button
                type="button"
                onClick={reconstructionBack}
                className="text-xs px-3 py-2 rounded-lg border border-white/10 bg-black/40 text-zinc-400 hover:text-white backdrop-blur w-fit"
              >
                ← Back
              </button>
              <div>
                <p className="text-[10px] uppercase tracking-[0.3em] text-zinc-500">
                  Your memory
                </p>
                <p className="text-3xl font-light text-amber-50">Now</p>
              </div>
            </div>
            <div className="pointer-events-auto">
              <button
                type="button"
                onClick={() => setEditorOpen((open) => !open)}
                className={`text-xs px-3 py-1.5 rounded-lg border backdrop-blur ${
                  editorOpen
                    ? "border-sky-400/40 text-sky-100 bg-sky-950/50"
                    : "border-white/10 text-zinc-500 hover:text-white bg-black/40"
                }`}
              >
                {editorOpen ? "Close editor" : "Edit scene"}
              </button>
            </div>
          </div>
          <p className="absolute top-28 left-1/2 -translate-x-1/2 text-[11px] text-zinc-500 z-20 pointer-events-none text-center max-w-md px-4">
            {editorOpen
              ? "Editor · drag to select · Backspace delete · right-drag orbit · save"
              : "Drag to look around · scroll to zoom"}
          </p>
        </main>
      )}

      {showFab && (
        <FloatingAddButton onClick={() => goUpload(fabOrigin)} />
      )}
    </div>
  );
}
