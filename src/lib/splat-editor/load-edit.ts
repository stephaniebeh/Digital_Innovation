import type { SplatSceneEdit } from "./types";
import { loadSplatEdit } from "./persistence";

/** Prefer server scene-edit.json for desk demos, then localStorage. */
export async function resolveSplatEdit(
  sceneKey: string
): Promise<SplatSceneEdit | null> {
  const deskMatch = sceneKey.match(/\/scenes\/(desk[123])\//);
  if (deskMatch) {
    try {
      const res = await fetch(`/api/scenes/${deskMatch[1]}/edit`);
      if (res.ok) {
        const data = (await res.json()) as { edit: SplatSceneEdit | null };
        if (data.edit) return data.edit;
      }
    } catch {
      /* fall through */
    }
  }
  return loadSplatEdit(sceneKey);
}
