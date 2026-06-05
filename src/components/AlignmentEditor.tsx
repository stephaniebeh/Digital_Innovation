"use client";

import { useEffect, useState } from "react";
import {
  AUTO_ALIGN_HINT,
  computeAutoAlignTransform,
} from "@/lib/auto-align";
import type {
  GizmoMode,
  SceneAlignmentState,
  SceneId,
  SceneTransform,
} from "@/lib/scene-alignment";
import {
  COLMAP_UPRIGHT_ROTATION_X,
  DEFAULT_TRANSFORM,
  flipColmapVertical,
  SCENE_IDS,
} from "@/lib/scene-alignment";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editing: SceneId;
  onEditingChange: (id: SceneId) => void;
  alignment: SceneAlignmentState;
  /** Records undo step, then applies */
  onAlignmentChange: (next: SceneAlignmentState) => void;
  /** Applies without a new undo step (gumball drag, number field typing) */
  onAlignmentPatch: (next: SceneAlignmentState) => void;
  onBeginEditStep: () => void;
  onEndEditStep: () => void;
  canUndo: boolean;
  onUndo: () => void;
  overlayBoth: boolean;
  onOverlayBothChange: (v: boolean) => void;
  /** Point clouds used for auto-align (desk2 → desk1) */
  desk1PointUrl: string;
  desk2PointUrl: string;
  gizmoMode: GizmoMode;
  onGizmoModeChange: (mode: GizmoMode) => void;
};

const NUDGE = 0.05;
const NUDGE_ROT = (2 * Math.PI) / 180;

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
  onAlignmentPatch,
  onBeginEditStep,
  onEndEditStep,
  canUndo,
  onUndo,
  overlayBoth,
  onOverlayBothChange,
  desk1PointUrl,
  desk2PointUrl,
  gizmoMode,
  onGizmoModeChange,
}: Props) {
  const t = alignment[editing];
  const [autoAligning, setAutoAligning] = useState(false);
  const [autoAlignError, setAutoAlignError] = useState<string | null>(null);

  async function runAutoAlign() {
    setAutoAlignError(null);
    setAutoAligning(true);
    onOverlayBothChange(true);
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

      let patch: Partial<SceneTransform> | null = null;
      const step = e.shiftKey ? NUDGE * 5 : NUDGE;
      const rotStep = e.shiftKey ? NUDGE_ROT * 3 : NUDGE_ROT;

      switch (e.key) {
        case "ArrowLeft":
          patch = { x: t.x - step };
          break;
        case "ArrowRight":
          patch = { x: t.x + step };
          break;
        case "ArrowUp":
          patch = e.altKey ? { y: t.y + step } : { z: t.z - step };
          break;
        case "ArrowDown":
          patch = e.altKey ? { y: t.y - step } : { z: t.z + step };
          break;
        case "[":
          patch = { rotationY: t.rotationY - rotStep };
          break;
        case "]":
          patch = { rotationY: t.rotationY + rotStep };
          break;
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

      e.preventDefault();
      onAlignmentChange(updateTransform(alignment, editing, patch));
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, editing, alignment, t, onAlignmentChange, onGizmoModeChange, onUndo]);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => onOpenChange(true)}
        className="absolute bottom-32 left-4 z-40 px-3 py-2 rounded-lg text-xs border border-amber-200/30 bg-black/70 text-amber-100/90 backdrop-blur hover:bg-black/90"
      >
        Align scenes
      </button>
    );
  }

  return (
    <div className="absolute bottom-32 left-4 z-40 w-[min(100%,340px)] rounded-xl border border-amber-200/20 bg-black/85 backdrop-blur-md shadow-xl text-sm overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 border-b border-white/10 gap-2">
        <span className="text-[10px] uppercase tracking-wider text-amber-200/80">
          Scene alignment
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

      <div className="p-3 space-y-3 max-h-[55vh] overflow-y-auto">
        <p className="text-[11px] text-zinc-500 leading-snug">
          Gumball or number fields below. Undo restores the previous step (one
          undo per gumball drag, button, or field). Ctrl+Z · keys 1/2/3 · arrows.
        </p>

        <div className="flex gap-2">
          {SCENE_IDS.map((id) => (
            <button
              key={id}
              type="button"
              onClick={() => onEditingChange(id)}
              className={`flex-1 py-1.5 rounded-lg text-xs border ${
                editing === id
                  ? "border-amber-200/50 bg-amber-950/50 text-amber-50"
                  : "border-white/10 text-zinc-400"
              }`}
            >
              {id}
            </button>
          ))}
        </div>

        <label className="flex items-center gap-2 text-xs text-zinc-400 cursor-pointer">
          <input
            type="checkbox"
            checked={overlayBoth}
            onChange={(e) => onOverlayBothChange(e.target.checked)}
            className="rounded"
          />
          Overlay all desk scenes while aligning
        </label>

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

        <div className="space-y-2 pt-1 border-t border-white/10">
          <p className="text-[10px] uppercase tracking-wider text-zinc-500">
            Orientation (top / bottom)
          </p>
          <button
            type="button"
            onClick={() =>
              onAlignmentChange(
                updateTransform(alignment, editing, flipColmapVertical(t))
              )
            }
            className="w-full py-2 text-xs rounded-lg border border-amber-200/30 text-amber-100/90 hover:bg-amber-950/40"
          >
            Flip upside-down (COLMAP fix)
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
              label="Z-up raw"
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
                  updateTransform(alignment, editing, { flipY: t.flipY * -1 })
                )
              }
            />
          </div>
          <button
            type="button"
            onClick={() =>
              onAlignmentChange({
                desk1: flipColmapVertical(alignment.desk1),
                desk2: flipColmapVertical(alignment.desk2),
                desk3: flipColmapVertical(alignment.desk3),
              })
            }
            className="w-full py-1.5 text-[11px] rounded-lg border border-white/10 text-zinc-400 hover:text-white"
          >
            Flip vertical — both scenes
          </button>
          <NumberField
            label="Tilt X (°)"
            value={(t.rotationX * 180) / Math.PI}
            step={5}
            onEditBegin={onBeginEditStep}
            onEditEnd={onEndEditStep}
            onChange={(deg) =>
              onAlignmentPatch(
                updateTransform(alignment, editing, {
                  rotationX: (deg * Math.PI) / 180,
                })
              )
            }
          />
          <NumberField
            label="Roll Z (°)"
            value={(t.rotationZ * 180) / Math.PI}
            step={5}
            onEditBegin={onBeginEditStep}
            onEditEnd={onEndEditStep}
            onChange={(deg) =>
              onAlignmentPatch(
                updateTransform(alignment, editing, {
                  rotationZ: (deg * Math.PI) / 180,
                })
              )
            }
          />
        </div>

        <div className="space-y-2 border-t border-white/10 pt-2">
          <p className="text-[10px] uppercase tracking-wider text-zinc-500">
            Position
          </p>
          <NumberField
            label="Left / Right (X)"
            value={t.x}
            step={0.05}
            onEditBegin={onBeginEditStep}
            onEditEnd={onEndEditStep}
            onChange={(x) =>
              onAlignmentPatch(updateTransform(alignment, editing, { x }))
            }
          />
          <NumberField
            label="Up / Down (Y)"
            value={t.y}
            step={0.05}
            onEditBegin={onBeginEditStep}
            onEditEnd={onEndEditStep}
            onChange={(y) =>
              onAlignmentPatch(updateTransform(alignment, editing, { y }))
            }
          />
          <NumberField
            label="Forward / Back (Z)"
            value={t.z}
            step={0.05}
            onEditBegin={onBeginEditStep}
            onEditEnd={onEndEditStep}
            onChange={(z) =>
              onAlignmentPatch(updateTransform(alignment, editing, { z }))
            }
          />
          <NumberField
            label="Rotate Y (°)"
            value={(t.rotationY * 180) / Math.PI}
            step={1}
            onEditBegin={onBeginEditStep}
            onEditEnd={onEndEditStep}
            onChange={(deg) =>
              onAlignmentPatch(
                updateTransform(alignment, editing, {
                  rotationY: (deg * Math.PI) / 180,
                })
              )
            }
          />
          <NumberField
            label="Scale"
            value={t.scale}
            step={0.05}
            min={0.01}
            onEditBegin={onBeginEditStep}
            onEditEnd={onEndEditStep}
            onChange={(scale) =>
              onAlignmentPatch(updateTransform(alignment, editing, { scale }))
            }
          />
        </div>

        <div className="flex gap-2 pt-1">
          <button
            type="button"
            onClick={() =>
              onAlignmentChange(
                updateTransform(alignment, editing, { ...DEFAULT_TRANSFORM })
              )
            }
            className="flex-1 py-1.5 text-xs rounded-lg border border-white/10 text-zinc-400 hover:text-white"
          >
            Reset {editing}
          </button>
          <button
            type="button"
            onClick={() => onAlignmentChange(defaultAlignmentFromModule())}
            className="flex-1 py-1.5 text-xs rounded-lg border border-white/10 text-zinc-400 hover:text-white"
          >
            Reset all
          </button>
        </div>
      </div>
    </div>
  );
}

function defaultAlignmentFromModule(): SceneAlignmentState {
  return {
    desk1: { ...DEFAULT_TRANSFORM },
    desk2: { ...DEFAULT_TRANSFORM },
    desk3: { ...DEFAULT_TRANSFORM },
  };
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

function NumberField({
  label,
  value,
  step,
  onChange,
  onEditBegin,
  onEditEnd,
  min,
}: {
  label: string;
  value: number;
  step: number;
  onChange: (v: number) => void;
  onEditBegin: () => void;
  onEditEnd: () => void;
  min?: number;
}) {
  return (
    <label className="block space-y-1">
      <span className="text-[11px] text-zinc-500">{label}</span>
      <input
        type="number"
        step={step}
        value={Number.isFinite(value) ? value : 0}
        min={min}
        onFocus={onEditBegin}
        onBlur={onEditEnd}
        onChange={(e) => {
          const n = parseFloat(e.target.value);
          if (!Number.isNaN(n)) onChange(n);
        }}
        className="w-full px-2 py-1.5 rounded-lg bg-zinc-900 border border-white/10 text-zinc-200 text-xs font-mono focus:border-amber-200/40 focus:outline-none"
      />
    </label>
  );
}
