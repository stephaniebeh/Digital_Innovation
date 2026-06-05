import type { SplatSceneEdit } from "./types";

const STORAGE_PREFIX = "afterimage-splat-edit:";

export function loadSplatEdit(sceneKey: string): SplatSceneEdit | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_PREFIX + sceneKey);
    if (!raw) return null;
    return JSON.parse(raw) as SplatSceneEdit;
  } catch {
    return null;
  }
}

export function saveSplatEditLocal(edit: SplatSceneEdit): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_PREFIX + edit.sceneKey, JSON.stringify(edit));
}

export async function saveSplatEditToServer(
  deskId: string,
  edit: SplatSceneEdit
): Promise<void> {
  const res = await fetch(`/api/scenes/${deskId}/edit`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(edit),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(
      (data as { error?: string }).error ?? `Save failed (${res.status})`
    );
  }
}

export function downloadSplatEditJson(edit: SplatSceneEdit): void {
  const blob = new Blob([JSON.stringify(edit, null, 2)], {
    type: "application/json",
  });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `splat-edit-${edit.label ?? "scene"}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
}
