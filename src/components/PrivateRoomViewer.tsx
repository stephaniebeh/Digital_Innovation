"use client";

import dynamic from "next/dynamic";
import { useMemo } from "react";
import AlignmentEditor from "@/components/AlignmentEditor";
import MemoryTimeline from "@/components/MemoryTimeline";
import SplatEditorPanel from "@/components/SplatEditorPanel";
import {
  TIMELINE_MOMENTS,
  TIMELINE_YEARS,
  blendForTimelinePosition,
  momentIndexAtTimeline,
  yearAtTimelinePosition,
} from "@/lib/demo-scenes";
import type {
  AlignSceneVisibility,
  GizmoMode,
  SceneAlignmentState,
  SceneId,
  SceneTransform,
} from "@/lib/scene-alignment";
import type { SplatViewerHandle } from "@/lib/splat-viewer-api";
import { DESK_ROOM_TIMELINE_STATS } from "@/lib/timeline-stats";

const SceneViewer = dynamic(() => import("@/components/SceneViewer"), {
  ssr: false,
});

type Props = {
  timelinePos: number;
  onTimelineChange: (t: number) => void;
  alignment: SceneAlignmentState;
  onAlignmentChange: (next: SceneAlignmentState) => void;
  alignOpen: boolean;
  onAlignOpenChange: (open: boolean) => void;
  editorOpen: boolean;
  onEditorOpenChange: (open: boolean) => void;
  alignSceneVisibility: AlignSceneVisibility;
  onSceneVisibilityChange: (id: SceneId, visible: boolean) => void;
  editingScene: SceneId;
  onEditingSceneChange: (id: SceneId) => void;
  gizmoMode: GizmoMode;
  onGizmoModeChange: (mode: GizmoMode) => void;
  editorHandle: SplatViewerHandle | null;
  onAlignTransformPatch: (id: SceneId, transform: SceneTransform) => void;
  onAlignDragStart: () => void;
  onEditorHandle: (handle: SplatViewerHandle | null) => void;
  canUndo: boolean;
  onUndo: () => void;
  onBack: () => void;
  hotspotOpen: boolean;
  onHotspotToggle: () => void;
};

const momentById = (id: string) => TIMELINE_MOMENTS.find((m) => m.id === id);

export default function PrivateRoomViewer({
  timelinePos,
  onTimelineChange,
  alignment,
  onAlignmentChange,
  alignOpen,
  onAlignOpenChange,
  editorOpen,
  onEditorOpenChange,
  alignSceneVisibility,
  onSceneVisibilityChange,
  editingScene,
  onEditingSceneChange,
  gizmoMode,
  onGizmoModeChange,
  editorHandle,
  onAlignTransformPatch,
  onAlignDragStart,
  onEditorHandle,
  canUndo,
  onUndo,
  onBack,
  hotspotOpen,
  onHotspotToggle,
}: Props) {
  const blend = blendForTimelinePosition(timelinePos);
  const displayYear = yearAtTimelinePosition(timelinePos);
  const activeMoment =
    TIMELINE_MOMENTS[momentIndexAtTimeline(timelinePos)] ?? TIMELINE_MOMENTS[0];

  const hint = useMemo(() => {
    if (editorOpen) {
      return "Editor · drag to select · Backspace delete · right-drag orbit · save";
    }
    if (alignOpen) {
      return "Align · drag gumball · toggle visibility · save changes · Ctrl+Z undo";
    }
    return "Drag to orbit · scroll to zoom · scrub the timeline below";
  }, [alignOpen, editorOpen]);

  return (
    <main className="flex-1 flex flex-col relative min-h-0 h-[100dvh]">
      <div className="absolute inset-0 bottom-28">
        <SceneViewer
          timelineMoments={TIMELINE_MOMENTS}
          timelinePos={blend}
          aholoSplatUrl={null}
          aholoModelFormat="ply"
          alignment={alignment}
          overlayBoth={false}
          alignMode={alignOpen}
          alignSceneVisibility={alignSceneVisibility}
          editingScene={editingScene}
          gizmoMode={gizmoMode}
          onAlignTransformPatch={onAlignTransformPatch}
          onAlignDragStart={onAlignDragStart}
          onEditorHandle={onEditorHandle}
        />

        <SplatEditorPanel
          open={editorOpen}
          onOpenChange={onEditorOpenChange}
          handle={editorHandle}
        />

        <AlignmentEditor
          open={alignOpen}
          onOpenChange={onAlignOpenChange}
          editing={editingScene}
          onEditingChange={onEditingSceneChange}
          alignment={alignment}
          onAlignmentChange={onAlignmentChange}
          canUndo={canUndo}
          onUndo={onUndo}
          sceneVisibility={alignSceneVisibility}
          onSceneVisibilityChange={onSceneVisibilityChange}
          desk1PointUrl={momentById("desk1")?.alignUrl ?? ""}
          desk2PointUrl={momentById("desk2")?.alignUrl ?? ""}
          gizmoMode={gizmoMode}
          onGizmoModeChange={onGizmoModeChange}
        />
      </div>

      <div className="absolute top-0 left-0 right-0 p-4 flex justify-between items-start pointer-events-none z-20">
        <div className="pointer-events-auto flex flex-col gap-2">
          <button
            type="button"
            onClick={onBack}
            className="text-xs px-3 py-2 rounded-lg border border-white/10 bg-black/40 text-zinc-400 hover:text-white backdrop-blur w-fit"
          >
            ← My spaces
          </button>
          <div>
            <p className="text-[10px] uppercase tracking-[0.3em] text-zinc-500">
              My Room
            </p>
            <p
              className="text-4xl font-light tabular-nums text-amber-50 transition-all duration-200"
              key={displayYear}
            >
              {displayYear}
            </p>
          </div>
        </div>

        <div className="pointer-events-auto flex gap-2">
          <button
            type="button"
            onClick={() => {
              onEditorOpenChange(!editorOpen);
              if (!editorOpen) onAlignOpenChange(false);
            }}
            className={`text-xs px-3 py-1.5 rounded-lg border backdrop-blur ${
              editorOpen
                ? "border-sky-400/40 text-sky-100 bg-sky-950/50"
                : "border-white/10 text-zinc-500 hover:text-white bg-black/40"
            }`}
          >
            {editorOpen ? "Close editor" : "Edit scene"}
          </button>
          <button
            type="button"
            onClick={() => {
              onAlignOpenChange(!alignOpen);
              if (!alignOpen) onEditorOpenChange(false);
            }}
            className={`text-xs px-3 py-1.5 rounded-lg border backdrop-blur ${
              alignOpen
                ? "border-amber-200/40 text-amber-100 bg-amber-950/50"
                : "border-white/10 text-zinc-500 hover:text-white bg-black/40"
            }`}
          >
            {alignOpen ? "Close align" : "Align scenes"}
          </button>
        </div>
      </div>

      {hint && (
        <p className="absolute top-28 left-1/2 -translate-x-1/2 text-[11px] text-zinc-500 z-20 pointer-events-none text-center max-w-md px-4">
          {hint}
        </p>
      )}

      {activeMoment?.photos &&
        activeMoment.photos.length > 0 &&
        !editorOpen &&
        !alignOpen && (
          <div className="absolute right-4 top-1/2 -translate-y-1/2 z-20 flex flex-col gap-2">
            <button
              type="button"
              onClick={onHotspotToggle}
              className="px-3 py-2 rounded-full bg-black/50 border border-amber-200/30 text-xs text-amber-100/90 backdrop-blur hover:bg-black/70"
            >
              {hotspotOpen ? "Hide photos" : "Photos"}
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
                      alt={photo.caption ?? "Photograph"}
                      className="w-full aspect-[4/3] object-cover"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = "none";
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
          onChange={onTimelineChange}
          years={TIMELINE_YEARS}
          startLabel="Earlier"
          endLabel="Later"
          statsKeyframes={DESK_ROOM_TIMELINE_STATS}
        />
      </div>
    </main>
  );
}
