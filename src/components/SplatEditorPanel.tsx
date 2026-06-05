"use client";

import { useCallback, useEffect, useState } from "react";
import {
  defaultCropFromScene,
  useSplatEditorBinding,
} from "@/hooks/useSplatEditorBinding";
import {
  downloadSplatEditJson,
  loadSplatEdit,
  saveSplatEditLocal,
  saveSplatEditToServer,
} from "@/lib/splat-editor/persistence";
import {
  DEFAULT_TRANSFORM,
  deskIdFromSceneKey,
  type SplatEditTool,
  type SplatSceneEdit,
} from "@/lib/splat-editor/types";
import type { SplatViewerHandle } from "@/lib/splat-viewer-api";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  handle: SplatViewerHandle | null;
};

const TOOLS: { id: SplatEditTool; label: string; hint: string }[] = [
  {
    id: "select",
    label: "Select",
    hint: "Drag to select (yellow dots) · Backspace deletes · right-drag to orbit · empty drag = no box",
  },
  { id: "crop", label: "Crop", hint: "Drag blue box · trims on save" },
  { id: "move", label: "Move", hint: "Translate scene" },
  { id: "rotate", label: "Rotate", hint: "Rotate scene" },
  { id: "scale", label: "Scale", hint: "Uniform scale" },
];

export default function SplatEditorPanel({ open, onOpenChange, handle }: Props) {
  const [tool, setTool] = useState<SplatEditTool>("select");
  const [edit, setEdit] = useState<SplatSceneEdit | null>(null);
  const [saveStatus, setSaveStatus] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    if (!handle) {
      setEdit(null);
      return;
    }
    const saved = loadSplatEdit(handle.sceneKey);
    setEdit(
      saved ?? {
        version: 1,
        sceneKey: handle.sceneKey,
        label: handle.label,
        transform: { ...DEFAULT_TRANSFORM },
        crop: null,
        updatedAt: new Date().toISOString(),
      }
    );
    setTool("select");
    setSaveStatus(null);
    setSaveError(null);
  }, [handle?.sceneKey, handle?.label]);

  const patchEdit = useCallback((patch: Partial<SplatSceneEdit>) => {
    setEdit((prev) =>
      prev
        ? { ...prev, ...patch, updatedAt: new Date().toISOString() }
        : prev
    );
  }, []);

  useEffect(() => {
    if (tool !== "crop" || !handle || !edit || edit.crop) return;
    const scene = handle.getSplatScene();
    if (!scene) return;
    patchEdit({ crop: defaultCropFromScene(scene) });
  }, [tool, handle, edit, patchEdit]);

  useSplatEditorBinding({
    handle,
    tool,
    edit: edit ?? {
      version: 1,
      sceneKey: "",
      transform: DEFAULT_TRANSFORM,
      crop: null,
      updatedAt: "",
    },
    onEditChange: patchEdit,
    enabled: open && !!edit && !!handle,
  });

  const resetTransform = () => {
    patchEdit({ transform: { ...DEFAULT_TRANSFORM }, crop: null });
  };

  const saveChanges = async () => {
    if (!edit || !handle) return;
    setSaveError(null);
    setSaveStatus("Saving…");
    try {
      saveSplatEditLocal(edit);
      const deskId = deskIdFromSceneKey(handle.sceneKey);
      if (deskId) {
        await saveSplatEditToServer(deskId, edit);
        setSaveStatus(`Saved to public/scenes/${deskId}/scene-edit.json`);
      } else {
        downloadSplatEditJson(edit);
        setSaveStatus("Saved locally + downloaded JSON");
      }
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Save failed");
      setSaveStatus(null);
    }
  };

  if (!open) return null;

  return (
    <div className="absolute right-4 top-28 bottom-36 z-40 flex gap-2 pointer-events-none">
      <aside className="pointer-events-auto w-52 rounded-xl border border-white/10 bg-zinc-950/95 backdrop-blur shadow-xl flex flex-col overflow-hidden">
        <div className="px-3 py-2.5 border-b border-white/10 flex items-center justify-between">
          <div>
            <p className="text-[10px] uppercase tracking-wider text-zinc-500">
              Scene editor
            </p>
            <p className="text-xs text-zinc-300 truncate max-w-[140px]">
              {handle?.label ?? "No scene"}
            </p>
          </div>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="text-zinc-500 hover:text-white text-xs px-1.5"
            aria-label="Close editor"
          >
            ✕
          </button>
        </div>

        <div className="p-2 space-y-1 border-b border-white/10">
          {TOOLS.map((t) => (
            <button
              key={t.id}
              type="button"
              disabled={!handle}
              onClick={() => setTool(t.id)}
              className={`w-full text-left px-2.5 py-2 rounded-lg text-xs transition-colors ${
                tool === t.id
                  ? "bg-sky-950/60 border border-sky-400/40 text-sky-100"
                  : "border border-transparent text-zinc-400 hover:text-white hover:bg-white/5"
              } disabled:opacity-40`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="p-3 flex-1 space-y-3 text-[11px] text-zinc-500 overflow-y-auto">
          <p className="leading-snug">
            {TOOLS.find((t) => t.id === tool)?.hint}
          </p>
          {edit?.crop && tool === "crop" && (
            <p className="text-zinc-600 font-mono text-[10px] leading-relaxed">
              crop min [{edit.crop.min.map((n) => n.toFixed(2)).join(", ")}]
              <br />
              crop max [{edit.crop.max.map((n) => n.toFixed(2)).join(", ")}]
            </p>
          )}
          {saveStatus && (
            <p className="text-emerald-400/90 text-[10px]">{saveStatus}</p>
          )}
          {saveError && (
            <p className="text-red-400/90 text-[10px]">{saveError}</p>
          )}
        </div>

        <div className="p-2 border-t border-white/10 space-y-1.5">
          <button
            type="button"
            disabled={!handle || !edit}
            onClick={() => void saveChanges()}
            className="w-full py-2 rounded-lg bg-sky-500/90 text-black text-xs font-medium hover:bg-sky-400 disabled:opacity-40"
          >
            Save changes
          </button>
          <button
            type="button"
            disabled={!handle}
            onClick={resetTransform}
            className="w-full py-1.5 rounded-lg border border-white/10 text-zinc-400 text-xs hover:text-white"
          >
            Reset transform
          </button>
        </div>
      </aside>
    </div>
  );
}
