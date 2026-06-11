"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useState } from "react";
import FloatingAddButton from "@/components/FloatingAddButton";
import LandingPage from "@/components/LandingPage";
import PrivateHubPage from "@/components/PrivateHubPage";
import PrivateRoomViewer from "@/components/PrivateRoomViewer";
import PublicMapPage from "@/components/PublicMapPage";
import PublicPlacePlaceholder from "@/components/PublicPlacePlaceholder";
import PublicPlaceViewer from "@/components/PublicPlaceViewer";
import ReconstructionJobStack from "@/components/ReconstructionJobStack";
import ReconstructionLoader from "@/components/ReconstructionLoader";
import SplatEditorPanel from "@/components/SplatEditorPanel";
import UploadPhotosPage from "@/components/UploadPhotosPage";
import { useAlignmentHistory } from "@/hooks/useAlignmentHistory";
import { useReconstructionQueue } from "@/hooks/useReconstructionQueue";
import { MIN_RECONSTRUCTION_IMAGES } from "@/lib/aholo/client";
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
import { visibleJobs } from "@/lib/reconstruction-jobs";
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

export default function Home() {
  const [phase, setPhase] = useState<Phase>("landing");
  const [uploadOrigin, setUploadOrigin] = useState<UploadOrigin>("public");
  const [publicTimelinePos, setPublicTimelinePos] = useState(0.66);
  const [privateTimelinePos, setPrivateTimelinePos] = useState(0);
  const [selectedPlaceId, setSelectedPlaceId] = useState<string | null>(null);
  const [placeTimelinePos, setPlaceTimelinePos] = useState(0);

  const [selectedImages, setSelectedImages] = useState<File[]>([]);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadNotice, setUploadNotice] = useState<string | null>(null);
  const [archiveToast, setArchiveToast] = useState<string | null>(null);
  const [viewingJobId, setViewingJobId] = useState<string | null>(null);

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

  const {
    jobs,
    foregroundJob,
    foregroundJobId,
    setForegroundJobId,
    hasVisibleJobs,
    enqueue,
    cancelJob,
    dismissFailedJob,
    storeJob,
    setJobCollapsed,
    setJobExpanded,
  } = useReconstructionQueue();

  const stackJobs = visibleJobs(jobs);
  const viewingJob = jobs.find((j) => j.id === viewingJobId) ?? null;

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

  useEffect(() => {
    if (phase !== "loading" || !foregroundJob) return;
    if (foregroundJob.status === "ready" && foregroundJob.splatUrl) {
      setForegroundJobId(null);
      setPhase(uploadOrigin === "private" ? "private-hub" : "public-map");
      setJobExpanded(foregroundJob.id, true);
    }
  }, [
    phase,
    foregroundJob,
    uploadOrigin,
    setForegroundJobId,
    setJobExpanded,
  ]);

  useEffect(() => {
    if (!archiveToast) return;
    const t = window.setTimeout(() => setArchiveToast(null), 4000);
    return () => window.clearTimeout(t);
  }, [archiveToast]);

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
    setUploadError(null);
    setUploadNotice(null);
  }, []);

  const goLanding = useCallback(() => {
    setPhase("landing");
    setHotspotOpen(false);
  }, []);

  const goUpload = useCallback((from: UploadOrigin) => {
    setUploadOrigin(from);
    setUploadError(null);
    setUploadNotice(null);
    setPhase("upload");
  }, []);

  const enterPrivateRoom = useCallback(() => {
    setViewingJobId(null);
    setUploadError(null);
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

  const dismissLoadingToBrowse = useCallback(() => {
    if (foregroundJobId) {
      setJobCollapsed(foregroundJobId, true);
    }
    setForegroundJobId(null);
    setPhase(uploadOrigin === "private" ? "private-hub" : "public-map");
  }, [foregroundJobId, uploadOrigin, setForegroundJobId, setJobCollapsed]);

  const openJobViewer = useCallback(
    (jobId: string) => {
      const job = jobs.find((j) => j.id === jobId);
      if (!job?.splatUrl) return;
      setViewingJobId(jobId);
      setJobExpanded(jobId, false);
      setJobCollapsed(jobId, true);
      setEditorOpen(false);
      setEditorHandle(null);
      setPhase("reconstruction");
    },
    [jobs, setJobCollapsed, setJobExpanded]
  );

  const storeJobInArchive = useCallback(
    (jobId: string, target: "public" | "private") => {
      storeJob(jobId);
      setArchiveToast(
        target === "public"
          ? "Scan saved to campus map archive"
          : "Scan saved to my spaces"
      );
    },
    [storeJob]
  );

  const startRealReconstruction = useCallback(() => {
    if (!selectedImages.length) {
      setUploadError("Select photos first.");
      return;
    }
    if (!hasEnoughImages) {
      setUploadError(
        `Select at least ${MIN_RECONSTRUCTION_IMAGES} photos (${imagesNeeded} more needed).`
      );
      return;
    }

    const count = selectedImages.length;
    const images = [...selectedImages];
    const { jobId, startsNow } = enqueue(images, uploadOrigin);

    setSelectedImages([]);
    setUploadError(null);
    setUploadNotice(
      startsNow
        ? `Building ${count} photos…`
        : `${count} photos queued — waiting for the scan ahead`
    );

    if (startsNow) {
      setForegroundJobId(jobId);
      setPhase("loading");
    } else {
      setPhase("upload");
    }
  }, [
    selectedImages,
    hasEnoughImages,
    imagesNeeded,
    enqueue,
    uploadOrigin,
    setForegroundJobId,
  ]);

  const showFab =
    phase === "public-map" ||
    phase === "public-place" ||
    phase === "private-hub" ||
    phase === "private-room" ||
    phase === "reconstruction" ||
    phase === "upload" ||
    hasVisibleJobs;

  const fabOrigin: UploadOrigin =
    phase === "private-hub" || phase === "private-room" || uploadOrigin === "private"
      ? "private"
      : "public";

  const reconstructionBack = useCallback(() => {
    setEditorOpen(false);
    setEditorHandle(null);
    setViewingJobId(null);
    setPhase(uploadOrigin === "private" ? "private-hub" : "public-map");
  }, [uploadOrigin]);

  const handleExpandJob = useCallback(
    (id: string) => {
      setJobExpanded(id, true);
    },
    [setJobExpanded]
  );

  const handleCollapseJob = useCallback(
    (id: string) => {
      setJobCollapsed(id, true);
    },
    [setJobCollapsed]
  );

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
          onBack={goLanding}
        />
      )}

      {phase === "upload" && (
        <UploadPhotosPage
          fileCount={fileCount}
          minPhotos={MIN_RECONSTRUCTION_IMAGES}
          hasEnough={hasEnoughImages}
          error={uploadError}
          notice={uploadNotice}
          onPickFiles={applyPickedImages}
          onStart={() => void startRealReconstruction()}
          onBack={uploadBack}
        />
      )}

      {phase === "loading" && foregroundJob && (
        <main className="flex-1 flex items-center justify-center relative">
          <ReconstructionLoader
            stageIndex={foregroundJob.stageIndex}
            progress={foregroundJob.progress}
            statusLine={foregroundJob.statusLine}
            error={foregroundJob.error}
            onContinueBrowsing={dismissLoadingToBrowse}
          />
          {foregroundJob.error && (
            <div className="absolute bottom-20 left-1/2 -translate-x-1/2 flex gap-2 pointer-events-auto z-50">
              <button
                type="button"
                onClick={() => {
                  dismissFailedJob(foregroundJob.id);
                  setForegroundJobId(null);
                  setPhase("upload");
                }}
                className="text-xs px-3 py-2 rounded-lg border border-white/15 text-zinc-400 hover:text-white"
              >
                Back
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

      {phase === "reconstruction" && viewingJob?.splatUrl && (
        <main className="flex-1 flex flex-col relative min-h-0 h-[100dvh]">
          <div className="absolute inset-0">
            <SceneViewer
              timelineMoments={[]}
              timelinePos={0}
              aholoSplatUrl={viewingJob.splatUrl}
              aholoModelFormat={viewingJob.modelFormat}
              aholoLabel={viewingJob.label}
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
                <p className="text-3xl font-light text-amber-50">
                  {viewingJob.label}
                </p>
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

      {stackJobs.length > 0 && (
        <ReconstructionJobStack
          jobs={stackJobs}
          onExpand={handleExpandJob}
          onCollapse={handleCollapseJob}
          onView={openJobViewer}
          onStorePublic={(id) => storeJobInArchive(id, "public")}
          onStorePrivate={(id) => storeJobInArchive(id, "private")}
          onCancelJob={cancelJob}
          onDismissFailed={dismissFailedJob}
        />
      )}

      {archiveToast && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[1300] px-4 py-2 rounded-lg border border-emerald-200/30 bg-zinc-950/95 text-emerald-100 text-xs shadow-lg pointer-events-none">
          {archiveToast}
        </div>
      )}
    </div>
  );
}
