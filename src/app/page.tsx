"use client";

import dynamic from "next/dynamic";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type InputHTMLAttributes,
} from "react";
import AlignmentEditor from "@/components/AlignmentEditor";
import MemoryTimeline from "@/components/MemoryTimeline";
import ReconstructionLoader from "@/components/ReconstructionLoader";
import SkipToDemoButton from "@/components/SkipToDemoButton";
import { useAlignmentHistory } from "@/hooks/useAlignmentHistory";
import {
  MIN_RECONSTRUCTION_IMAGES,
  openExistingWorld,
  startReconstruction,
} from "@/lib/aholo/client";
import type { AholoModelFormat } from "@/lib/aholo/model-url";
import {
  defaultSplatAlignment,
  loadAlignment,
  saveAlignment,
  type GizmoMode,
  type SceneId,
} from "@/lib/scene-alignment";
import {
  RECONSTRUCTION_STAGES,
  TIMELINE_MOMENTS,
  blendForTimelinePosition,
  yearAtTimelinePosition,
} from "@/lib/demo-scenes";
import { imageFilesFromFileList } from "@/lib/image-file-picker";

const SceneViewer = dynamic(() => import("@/components/SceneViewer"), {
  ssr: false,
});

type Phase = "landing" | "loading" | "viewing";
type ViewerSource = "demo" | "aholo";

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

export default function Home() {
  const [phase, setPhase] = useState<Phase>("landing");
  const [viewerSource, setViewerSource] = useState<ViewerSource>("demo");
  const [selectedImages, setSelectedImages] = useState<File[]>([]);
  const [loadStage, setLoadStage] = useState(0);
  const [loadProgress, setLoadProgress] = useState(0);
  const [loadStatusLine, setLoadStatusLine] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [aholoSplatUrl, setAholoSplatUrl] = useState<string | null>(null);
  const [aholoModelFormat, setAholoModelFormat] =
    useState<AholoModelFormat>("ply");
  const [aholoWorldId, setAholoWorldId] = useState("");
  const [resumeWorldId, setResumeWorldId] = useState("");
  const [timelinePos, setTimelinePos] = useState(0);
  const [hotspotOpen, setHotspotOpen] = useState(false);
  const [alignOpen, setAlignOpen] = useState(false);
  const [alignOverlay, setAlignOverlay] = useState(true);
  const [editingScene, setEditingScene] = useState<SceneId>("desk2");
  const [gizmoMode, setGizmoMode] = useState<GizmoMode>("rotate");
  const pollAbortRef = useRef(false);

  const {
    alignment,
    changeAlignment,
    setAlignmentSilent,
    beginEditStep,
    endEditStep,
    undo: undoAlignment,
    canUndo,
  } = useAlignmentHistory(loadAlignment());

  useEffect(() => {
    saveAlignment(alignment);
  }, [alignment]);

  const fileCount = selectedImages.length;
  const hasEnoughImages = fileCount >= MIN_RECONSTRUCTION_IMAGES;
  const imagesNeeded = Math.max(0, MIN_RECONSTRUCTION_IMAGES - fileCount);

  const applyPickedImages = useCallback((list: FileList | null) => {
    setSelectedImages(imageFilesFromFileList(list));
    setLoadError(null);
  }, []);

  const primary = TIMELINE_MOMENTS[0];
  const secondary = TIMELINE_MOMENTS[TIMELINE_MOMENTS.length - 1] ?? primary;
  const blend = blendForTimelinePosition(timelinePos);
  const displayYear = yearAtTimelinePosition(timelinePos);
  const momentIndex = Math.min(
    TIMELINE_MOMENTS.length - 1,
    Math.round(timelinePos * Math.max(0, TIMELINE_MOMENTS.length - 1))
  );
  const activeMoment =
    viewerSource === "demo" ? TIMELINE_MOMENTS[momentIndex] : null;

  const enterDemoViewer = useCallback(() => {
    pollAbortRef.current = true;
    setViewerSource("demo");
    setAholoSplatUrl(null);
    setAholoModelFormat("ply");
    setLoadError(null);
    setLoadStatusLine(null);
    setTimelinePos(0);
    setAlignmentSilent(defaultSplatAlignment());
    setPhase("viewing");
  }, [setAlignmentSilent]);

  const returnToLanding = useCallback(() => {
    pollAbortRef.current = true;
    setPhase("landing");
    setLoadError(null);
    setLoadStatusLine(null);
    setAholoSplatUrl(null);
    setAholoModelFormat("ply");
    setViewerSource("demo");
  }, []);

  const startRealReconstruction = useCallback(async () => {
    if (!selectedImages.length) {
      setLoadError("Select photos first, then start reconstruction.");
      return;
    }
    if (!hasEnoughImages) {
      setLoadError(
        `Select at least ${MIN_RECONSTRUCTION_IMAGES} images (${imagesNeeded} more needed). Aholo requires 20+ photos per job.`
      );
      return;
    }

    pollAbortRef.current = false;
    setViewerSource("aholo");
    setLoadError(null);
    setLoadStatusLine(null);
    setPhase("loading");
    setLoadStage(0);
    setLoadProgress(0.05);

    try {
      setLoadStage(0);
      setLoadStatusLine("Uploading images to Aholo…");
      setLoadProgress(0.15);

      const { worldId, imageCount } = await startReconstruction(selectedImages, {
        name: "Afterimage capture",
        scene: "space",
        taskQuality: "high",
      });

      if (pollAbortRef.current) return;

      setLoadProgress(0.35);
      setAholoWorldId(worldId);
      setLoadStatusLine(`Job ${worldId} · ${imageCount} images uploaded`);

      const { proxiedUrl, format } = await openExistingWorld(worldId, {
        shouldAbort: () => pollAbortRef.current,
        onStatus: (status) => {
          setLoadStatusLine(`Job ${worldId} · ${status}`);
          setLoadStage(stageIndexForStatus(status, false));
          if (status === "PENDING") setLoadProgress(0.45);
          else if (status === "RUNNING") setLoadProgress(0.65);
          else if (status.includes("ply") || status.includes("spz"))
            setLoadProgress(0.9);
          else if (status === "SUCCEEDED") setLoadProgress(0.95);
        },
      });
      setAholoModelFormat(format);
      setAholoSplatUrl(proxiedUrl);
      setLoadProgress(1);
      setLoadStage(3);
      setPhase("viewing");
    } catch (err) {
      if (pollAbortRef.current) return;
      const message =
        err instanceof Error ? err.message : "Reconstruction failed";
      setLoadError(message);
      setLoadProgress(0);
    }
  }, [selectedImages, hasEnoughImages, imagesNeeded]);

  const resumeExistingWorld = useCallback(async () => {
    const id = resumeWorldId.trim();
    if (!id) return;
    pollAbortRef.current = false;
    setViewerSource("aholo");
    setLoadError(null);
    setPhase("loading");
    setLoadStage(2);
    setLoadProgress(0.4);
    setLoadStatusLine(`Job ${id} · checking status…`);
    try {
      setAholoWorldId(id);
      const { proxiedUrl, format } = await openExistingWorld(id, {
        shouldAbort: () => pollAbortRef.current,
        onStatus: (status) => {
          setLoadStatusLine(`Job ${id} · ${status}`);
          setLoadStage(stageIndexForStatus(status, false));
        },
      });
      setAholoModelFormat(format);
      setAholoSplatUrl(proxiedUrl);
      setLoadProgress(1);
      setLoadStage(3);
      setPhase("viewing");
    } catch (err) {
      if (pollAbortRef.current) return;
      setLoadError(err instanceof Error ? err.message : "Failed to open job");
    }
  }, [resumeWorldId]);

  const landing = phase === "landing";
  const loading = phase === "loading";
  const viewing = phase === "viewing";

  const hint = useMemo(() => {
    if (!viewing) return null;
    if (viewerSource === "aholo") {
      return "Aholo reconstruction · drag to orbit · scroll to zoom";
    }
    if (alignOpen) {
      return "Align mode · sliders · auto-align uses COLMAP scene.ply · Ctrl+Z undo · overlay both";
    }
    return "Timeline · left = 2020 desk · right = 2026 desk · drag to orbit · scroll zoom";
  }, [viewing, alignOpen, viewerSource]);

  const showAlignTools = viewing && viewerSource === "demo";

  return (
    <div className="min-h-screen bg-black text-white flex flex-col">
      {(landing || loading) && (
        <SkipToDemoButton onClick={enterDemoViewer} />
      )}

      {landing && (
        <main className="flex-1 flex flex-col items-center justify-center px-6 py-16 max-w-xl mx-auto w-full text-center gap-8">
          <header className="space-y-4">
            <p className="text-[10px] uppercase tracking-[0.35em] text-amber-200/60">
              Spatial archive prototype
            </p>
            <h1 className="text-4xl md:text-5xl font-semibold tracking-tight">
              Afterimage
            </h1>
            <p className="text-zinc-400 text-sm leading-relaxed">
              Upload photographs of a place — Aholo builds a 3D Gaussian splat, or
              skip to the desk1 / desk2 demo scenes.
            </p>
          </header>

          <section className="w-full space-y-4 rounded-2xl border border-white/10 bg-zinc-950/80 p-6 text-left">
            <label className="block text-sm text-zinc-400">
              Upload photographs (Aholo API)
            </label>
            <div className="flex flex-col sm:flex-row gap-2">
              <label className="flex-1 cursor-pointer">
                <input
                  type="file"
                  multiple
                  accept="image/*"
                  onChange={(e) => {
                    applyPickedImages(e.target.files);
                    e.target.value = "";
                  }}
                  className="w-full text-sm file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-white file:text-black file:font-medium cursor-pointer"
                />
              </label>
              <label className="shrink-0 cursor-pointer py-2 px-4 rounded-lg border border-white/15 text-xs text-zinc-300 hover:text-white hover:border-white/30 text-center">
                Select folder
                <input
                  type="file"
                  multiple
                  className="sr-only"
                  onChange={(e) => {
                    applyPickedImages(e.target.files);
                    e.target.value = "";
                  }}
                  {...({ webkitdirectory: "", directory: "" } as InputHTMLAttributes<HTMLInputElement>)}
                />
              </label>
            </div>
            <p className="text-xs text-zinc-500">
              {fileCount > 0
                ? `${fileCount} image${fileCount === 1 ? "" : "s"} selected${
                    hasEnoughImages
                      ? " — ready for reconstruction"
                      : ` — need ${imagesNeeded} more (Aholo minimum is ${MIN_RECONSTRUCTION_IMAGES})`
                  }`
                : `Pick at least ${MIN_RECONSTRUCTION_IMAGES} photos (use Select folder for a whole shoot)`}
            </p>
            {loadError && !loading && (
              <p className="text-xs text-red-400/90">{loadError}</p>
            )}
            <button
              type="button"
              onClick={() => void startRealReconstruction()}
              disabled={!hasEnoughImages}
              title={
                hasEnoughImages
                  ? undefined
                  : fileCount === 0
                    ? `Select at least ${MIN_RECONSTRUCTION_IMAGES} images`
                    : `Select ${imagesNeeded} more image${imagesNeeded === 1 ? "" : "s"} (${fileCount}/${MIN_RECONSTRUCTION_IMAGES})`
              }
              className="w-full py-3 rounded-xl bg-amber-100 text-black font-medium disabled:opacity-40 disabled:cursor-not-allowed hover:bg-white transition-colors"
            >
              {hasEnoughImages
                ? "Reconstruct with Aholo"
                : fileCount === 0
                  ? `Reconstruct with Aholo (${MIN_RECONSTRUCTION_IMAGES}+ photos)`
                  : `Need ${imagesNeeded} more photo${imagesNeeded === 1 ? "" : "s"} (${fileCount}/${MIN_RECONSTRUCTION_IMAGES})`}
            </button>
            <p className="text-[10px] text-zinc-600 text-center">
              Requires <code className="text-zinc-500">AHOLO_API_KEY</code> in{" "}
              <code className="text-zinc-500">.env.local</code> · uploads may take
              several minutes
            </p>
            <div className="pt-2 border-t border-white/10 space-y-2">
              <p className="text-[11px] text-zinc-500">
                Already have a <code className="text-zinc-400">worldId</code>?
                Resume without re-uploading:
              </p>
              <input
                type="text"
                value={resumeWorldId}
                onChange={(e) => setResumeWorldId(e.target.value)}
                placeholder="Paste worldId from Aholo or last job"
                className="w-full px-2 py-1.5 rounded-lg bg-zinc-900 border border-white/10 text-xs font-mono text-zinc-300"
              />
              <button
                type="button"
                onClick={() => void resumeExistingWorld()}
                disabled={!resumeWorldId.trim()}
                className="w-full py-2 text-xs rounded-lg border border-white/15 text-zinc-300 hover:text-white disabled:opacity-40"
              >
                Open existing reconstruction
              </button>
            </div>
          </section>

          <p className="text-[11px] text-zinc-600 max-w-sm">
            Demo skip (bottom left) loads 3D Gaussian splats for desk1 / desk2
            from <code className="text-zinc-500">scene-splat.ply</code> in each
            scene folder.
          </p>
        </main>
      )}

      {loading && (
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
                  setPhase("landing");
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
                Retry
              </button>
            </div>
          )}
        </main>
      )}

      {viewing && primary && secondary && (
        <main className="flex-1 flex flex-col relative min-h-0 h-[100dvh]">
          <div className="absolute inset-0 bottom-28">
            <SceneViewer
              primarySplatUrl={primary.splatUrl}
              secondarySplatUrl={secondary.splatUrl}
              aholoSplatUrl={
                viewerSource === "aholo" ? aholoSplatUrl : null
              }
              aholoModelFormat={aholoModelFormat}
              sourceLabel={
                viewerSource === "aholo" ? "Aholo reconstruction" : undefined
              }
              blend={blend}
              alignment={alignment}
              overlayBoth={showAlignTools && alignOpen && alignOverlay}
            />

            {showAlignTools && (
              <AlignmentEditor
                open={alignOpen}
                onOpenChange={setAlignOpen}
                editing={editingScene}
                onEditingChange={setEditingScene}
                alignment={alignment}
                onAlignmentChange={changeAlignment}
                onAlignmentPatch={setAlignmentSilent}
                onBeginEditStep={beginEditStep}
                onEndEditStep={endEditStep}
                canUndo={canUndo}
                onUndo={undoAlignment}
                overlayBoth={alignOverlay}
                onOverlayBothChange={setAlignOverlay}
                desk1PointUrl={primary.alignUrl}
                desk2PointUrl={secondary.alignUrl}
                gizmoMode={gizmoMode}
                onGizmoModeChange={setGizmoMode}
              />
            )}
          </div>

          <div className="absolute top-0 left-0 right-0 p-4 flex justify-between items-start pointer-events-none z-20">
            <div className="pointer-events-auto">
              <p className="text-[10px] uppercase tracking-[0.3em] text-zinc-500">
                {viewerSource === "aholo" ? "Reconstruction" : "Memory"}
              </p>
              {viewerSource === "aholo" && aholoWorldId && (
                <p className="text-[10px] text-zinc-600 font-mono truncate max-w-[200px]">
                  {aholoWorldId}
                </p>
              )}
              <p
                className="text-4xl font-light tabular-nums text-amber-50 transition-all duration-200"
                key={displayYear}
              >
                {viewerSource === "aholo" ? "Live" : displayYear}
              </p>
            </div>
            <div className="pointer-events-auto flex gap-2">
              {viewerSource === "demo" && (
                <button
                  type="button"
                  onClick={() => setAlignOpen((o) => !o)}
                  className="text-xs text-zinc-500 hover:text-white px-3 py-1.5 rounded-lg border border-white/10 bg-black/40 backdrop-blur"
                >
                  {alignOpen ? "Close align" : "Align scenes"}
                </button>
              )}
              <button
                type="button"
                onClick={returnToLanding}
                className="text-xs text-zinc-500 hover:text-white px-3 py-1.5 rounded-lg border border-white/10 bg-black/40 backdrop-blur"
              >
                New upload
              </button>
            </div>
          </div>

          {hint && (
            <p className="absolute top-24 left-1/2 -translate-x-1/2 text-[11px] text-zinc-500 z-20 pointer-events-none text-center max-w-md px-4">
              {hint}
            </p>
          )}

          {activeMoment?.photos && activeMoment.photos.length > 0 && (
            <div className="absolute right-4 top-1/2 -translate-y-1/2 z-20 flex flex-col gap-2">
              <button
                type="button"
                onClick={() => setHotspotOpen((o) => !o)}
                className="px-3 py-2 rounded-full bg-black/50 border border-amber-200/30 text-xs text-amber-100/90 backdrop-blur hover:bg-black/70"
              >
                {hotspotOpen ? "Hide archive" : "Archived photos"}
              </button>
              {hotspotOpen && (
                <div className="flex flex-col gap-2 max-w-[140px]">
                  {activeMoment.photos.map((photo) => (
                    <figure
                      key={photo.src}
                      className="rounded-lg overflow-hidden border border-white/10 bg-black/60 backdrop-blur"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={photo.src}
                        alt={photo.caption ?? "Archived photograph"}
                        className="w-full aspect-[4/3] object-cover"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display =
                            "none";
                        }}
                      />
                      {photo.caption && (
                        <figcaption className="text-[10px] text-zinc-400 px-2 py-1">
                          {photo.caption}
                        </figcaption>
                      )}
                    </figure>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="absolute bottom-0 left-0 right-0 z-30">
            <MemoryTimeline
              position={timelinePos}
              onChange={setTimelinePos}
            />
          </div>
        </main>
      )}
    </div>
  );
}
