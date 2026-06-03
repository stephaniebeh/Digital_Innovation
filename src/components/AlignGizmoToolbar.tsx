"use client";

import type { GizmoMode } from "@/lib/scene-alignment";

type Props = {
  mode: GizmoMode;
  onModeChange: (mode: GizmoMode) => void;
  editingLabel: string;
};

const MODES: { id: GizmoMode; label: string; key: string }[] = [
  { id: "translate", label: "Move", key: "1" },
  { id: "rotate", label: "Rotate", key: "2" },
  { id: "scale", label: "Scale", key: "3" },
];

export default function AlignGizmoToolbar({
  mode,
  onModeChange,
  editingLabel,
}: Props) {
  return (
    <div className="absolute top-28 right-4 z-30 flex flex-col gap-2 pointer-events-auto">
      <div className="rounded-xl border border-amber-200/25 bg-black/80 backdrop-blur-md shadow-lg p-2.5 space-y-2">
        <p className="text-[10px] uppercase tracking-wider text-amber-200/80 px-0.5">
          Gumball · {editingLabel}
        </p>
        <p className="text-[10px] text-zinc-500 leading-snug max-w-[200px] px-0.5">
          Drag colored axes on the scene. Orbit is paused while dragging.
        </p>
        <div className="flex gap-1">
          {MODES.map((m) => (
            <button
              key={m.id}
              type="button"
              title={`${m.label} (key ${m.key})`}
              onClick={() => onModeChange(m.id)}
              className={`flex-1 py-2 rounded-lg text-xs border transition-colors ${
                mode === m.id
                  ? "border-amber-200/50 bg-amber-950/60 text-amber-50"
                  : "border-white/10 text-zinc-400 hover:text-white hover:border-white/20"
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
