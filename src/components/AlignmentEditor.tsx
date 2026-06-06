"use client";

import { useEffect, useState } from "react";
import {
  AUTO_ALIGN_HINT,
  computeAutoAlignTransform,
} from "@/lib/auto-align";
import type {
  AlignSceneVisibility,
  GizmoMode,
  SceneAlignmentState,
  SceneId,
  SceneTransform,
} from "@/lib/scene-alignment";
import {
  downloadAlignmentJson,
  saveAlignmentLocal,
  saveAlignmentToServer,
} from "@/lib/alignment-persistence";
import {
  COLMAP_UPRIGHT_ROTATION_X,
  defaultSplatAlignment,
  flipColmapVertical,
  SCENE_IDS,
} from "@/lib/scene-alignment";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editing: SceneId;
  onEditingChange: (id: SceneId) => void;
  alignment: SceneAlignmentState;
  onAlignmentChange: (next: SceneAlignmentState) => void;
  canUndo: boolean;
  onUndo: () => void;
  sceneVisibility: AlignSceneVisibility;
  onSceneVisibilityChange: (id: SceneId, visible: boolean) => void;
  desk1PointUrl: string;
  desk2PointUrl: string;
  gizmoMode: GizmoMode;
  onGizmoModeChange: (mode: GizmoMode) => void;
};

const GIZMO_MODES: { id: GizmoMode; label: string }[] = [
  { id: "translate", label: "Move" },
  { id: "rotate", label: "Rotate" },
  { id: "scale", label: "Scale" },
];

function updateTransform(
  alignment: SceneAlignmentState,
  id: SceneId,
  patch: Partial<SceneTransform>
): SceneAlignmentState {
  return {
    ...alignment,
    [id]: { ...alignment[id], ...patch },
  };
}

export default function AlignmentEditor({
  open,
  onOpenChange,
  editing,
  onEditingChange,
  alignment,
  onAlignmentChange,
  canUndo,
  onUndo,
  sceneVisibility,
  onSceneVisibilityChange,
  desk1PointUrl,
  desk2PointUrl,
  gizmoMode,
  onGizmoModeChange,
}: Props) {
  const [autoAligning, setAutoAligning] = useState(false);
  const [autoAlignError, setAutoAlignError] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savePhase, setSavePhase] = useState<"idle" | "saving" | "saved">(
    "idle"
  );

  useEffect(() => {
    if (savePhase === "saved") setSavePhase("idle");
  }, [alignment]);

  async function saveChanges() {
    setSaveError(null);
    setSaveStatus(null);
    setSavePhase("saving");
    try {
      saveAlignmentLocal(alignment);
      await saveAlignmentToServer(alignment);
      setSavePhase("saved");
      setSaveStatus("Saved to public/scenes/scene-alignment.json");
      window.setTimeout(() => setSavePhase("idle"), 3000);
    } catch (e) {
      saveAlignmentLocal(alignment);
      downloadAlignmentJson(alignment);
      setSavePhase("saved");
      setSaveStatus("Saved locally + downloaded JSON");
      setSaveError(
        e instanceof Error ? e.message : "Server save failed"
      );
      window.setTimeout(() => setSavePhase("idle"), 3000);
    }
  }

  function resetAll() {
    onAlignmentChange(defaultSplatAlignment());
    setSaveStatus(null);
    setSaveError(null);
    setSavePhase("idle");
  }

  async function runAutoAlign() {
    setAutoAlignError(null);
    setAutoAligning(true);
    onSceneVisibilityChange("desk1", true);
    onSceneVisibilityChange("desk2", true);
    onEditingChange("desk2");
    try {
      const desk2Transform = await computeAutoAlignTransform(
        desk2PointUrl,
        desk1PointUrl,
        alignment.desk1
      );
      onAlignmentChange({ ...alignment, desk2: desk2Transform });
    } catch (e) {
      setAutoAlignError(
        e instanceof Error ? e.message : "Auto-align failed"
      );
    } finally {
      setAutoAligning(false);
    }
  }

  useEffect(() => {
    if (!open) return;

    function onKeyDown(e: KeyboardEvent) {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      switch (e.key) {
        case "1":
          onGizmoModeChange("translate");
          return;
        case "2":
          onGizmoModeChange("rotate");
          return;
        case "3":
          onGizmoModeChange("scale");
          return;
        case "z":
        case "Z":
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            onUndo();
          }
          return;
        default:
          return;
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onGizmoModeChange, onUndo]);

  if (!open) return null;

  return (
    <aside className="absolute right-4 top-28 z-40 w-56 rounded-xl border border-amber-200/20 bg-black/90 backdrop-blur-md shadow-xl text-sm overflow-hidden pointer-events-auto">
      <div className="flex items-center justify-between px-3 py-2 border-b border-white/10 gap-2">
        <span className="text-[10px] uppercase tracking-wider text-amber-200/80">
          Align scenes
        </span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={!canUndo}
            onClick={onUndo}
            title="Undo (Ctrl+Z)"
            className="text-xs px-2 py-1 rounded-md border border-white/10 text-zinc-400 hover:text-white disabled:opacity-35 disabled:pointer-events-none"
          >
            Undo
          </button>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="text-zinc-500 hover:text-white text-xs"
          >
            Done
          </button>
        </div>
      </div>

      <div className="p-3 space-y-3 max-h-[60vh] overflow-y-auto">
        <p className="text-[11px] text-zinc-500 leading-snug">
          Drag the gumball on the scene to move, rotate, or scale. Keys 1 / 2 / 3
          switch tools · Ctrl+Z undo.
        </p>

        <div className="flex gap-1">
          {GIZMO_MODES.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => onGizmoModeChange(m.id)}
              className={`flex-1 py-1.5 rounded-lg text-xs border ${
                gizmoMode === m.id
                  ? "border-amber-200/50 bg-amber-950/50 text-amber-50"
                  : "border-white/10 text-zinc-400 hover:text-white"
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>

        <div className="space-y-1">
          <p className="text-[10px] uppercase tracking-wider text-zinc-500">
            Edit scene
          </p>
          <div className="flex gap-1">
            {SCENE_IDS.map((id) => (
              <button
                key={id}
                type="button"
                onClick={() => onEditingChange(id)}
                className={`flex-1 py-1.5 rounded-lg text-xs border ${
                  editing === id
                    ? "border-amber-200/50 bg-amber-950/50 text-amber-50"
                    : "border-white/10 text-zinc-400 hover:text-white"
                }`}
              >
                {id}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-1.5 pt-1 border-t border-white/10">
          <p className="text-[10px] uppercase tracking-wider text-zinc-500">
            Visible scenes
          </p>
          {SCENE_IDS.map((id) => (
            <label
              key={id}
              className="flex items-center gap-2 text-xs text-zinc-400 cursor-pointer"
            >
              <input
                type="checkbox"
                checked={sceneVisibility[id]}
                onChange={(e) => onSceneVisibilityChange(id, e.target.checked)}
                className="rounded"
              />
              Show {id}
            </label>
          ))}
        </div>

        <div className="space-y-1.5 pt-1 border-t border-white/10">
          <p className="text-[10px] uppercase tracking-wider text-zinc-500">
            Auto-align
          </p>
          <p className="text-[11px] text-zinc-500 leading-snug">{AUTO_ALIGN_HINT}</p>
          <button
            type="button"
            disabled={autoAligning}
            onClick={() => void runAutoAlign()}
            className="w-full py-2 text-xs rounded-lg border border-emerald-200/30 text-emerald-100/90 hover:bg-emerald-950/40 disabled:opacity-50"
          >
            {autoAligning ? "Matching point clouds…" : "Auto-align desk2 → desk1"}
          </button>
          {autoAlignError && (
            <p className="text-[11px] text-red-400/90">{autoAlignError}</p>
          )}
        </div>

        <div className="space-y-1.5 pt-1 border-t border-white/10">
          <p className="text-[10px] uppercase tracking-wider text-zinc-500">
            Orientation
          </p>
          <button
            type="button"
            onClick={() =>
              onAlignmentChange(
                updateTransform(alignment, editing, flipColmapVertical(alignment[editing]))
              )
            }
            className="w-full py-2 text-xs rounded-lg border border-amber-200/30 text-amber-100/90 hover:bg-amber-950/40"
          >
            Flip upside-down
          </button>
          <div className="grid grid-cols-3 gap-1.5">
            <OrientBtn
              label="Y-up"
              onClick={() =>
                onAlignmentChange(
                  updateTransform(alignment, editing, {
                    rotationX: COLMAP_UPRIGHT_ROTATION_X,
                    rotationZ: 0,
                  })
                )
              }
            />
            <OrientBtn
              label="Z-up"
              onClick={() =>
                onAlignmentChange(
                  updateTransform(alignment, editing, {
                    rotationX: 0,
                    rotationZ: 0,
                  })
                )
              }
            />
            <OrientBtn
              label="Flip Y"
              onClick={() =>
                onAlignmentChange(
                  updateTransform(alignment, editing, {
                    flipY: alignment[editing].flipY * -1,
                  })
                )
              }
            />
          </div>
        </div>

        {saveStatus && (
          <p className="text-emerald-400/90 text-[10px]">{saveStatus}</p>
        )}
        {saveError && (
          <p className="text-amber-400/90 text-[10px]">{saveError}</p>
        )}
      </div>

      <div className="p-2 border-t border-white/10 space-y-1.5">
        <button
          type="button"
          disabled={savePhase === "saving"}
          onClick={() => void saveChanges()}
          className={`w-full py-2 rounded-lg text-xs font-medium transition-colors duration-200 ${
            savePhase === "saved"
              ? "bg-emerald-500 text-black"
              : savePhase === "saving"
                ? "bg-amber-500/50 text-black/70 cursor-wait"
                : "bg-amber-500/90 text-black hover:bg-amber-400"
          }`}
        >
          {savePhase === "saving"
            ? "Saving…"
            : savePhase === "saved"
              ? "Saved ✓"
              : "Save changes"}
        </button>
        <button
          type="button"
          onClick={resetAll}
          className="w-full py-1.5 rounded-lg border border-white/10 text-zinc-400 text-xs hover:text-white"
        >
          Reset alignment
        </button>
      </div>
    </aside>
  );
}

function OrientBtn({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="py-1.5 text-[10px] rounded-lg border border-white/10 text-zinc-400 hover:text-white hover:border-white/20"
    >
      {label}
    </button>
  );
}
