import {
  loadAlignment,
  saveAlignment,
  type SceneAlignmentState,
} from "@/lib/scene-alignment";

export function saveAlignmentLocal(alignment: SceneAlignmentState): void {
  saveAlignment(alignment);
}

export async function saveAlignmentToServer(
  alignment: SceneAlignmentState
): Promise<void> {
  const res = await fetch("/api/scenes/alignment", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(alignment),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(
      (data as { error?: string }).error ?? `Save failed (${res.status})`
    );
  }
}

export function downloadAlignmentJson(alignment: SceneAlignmentState): void {
  const blob = new Blob([JSON.stringify(alignment, null, 2)], {
    type: "application/json",
  });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "scene-alignment.json";
  a.click();
  URL.revokeObjectURL(a.href);
}

/** Prefer server file when present, then localStorage. */
export async function resolveAlignment(): Promise<SceneAlignmentState> {
  try {
    const res = await fetch("/api/scenes/alignment");
    if (res.ok) {
      const data = (await res.json()) as { alignment: SceneAlignmentState | null };
      if (data.alignment) return data.alignment;
    }
  } catch {
    /* fall through */
  }
  return loadAlignment();
}
