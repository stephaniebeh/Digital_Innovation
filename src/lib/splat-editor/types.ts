/** Scene edit state — move / rotate / scale / crop for splat scenes */

export type SplatEditTool = "select" | "crop" | "move" | "rotate" | "scale";

export type SplatTransformEdit = {
  position: [number, number, number];
  rotation: [number, number, number];
  scale: [number, number, number];
};

export type SplatCropBox = {
  min: [number, number, number];
  max: [number, number, number];
};

export type SplatSceneEdit = {
  version: 1;
  sceneKey: string;
  label?: string;
  transform: SplatTransformEdit;
  crop: SplatCropBox | null;
  /** Global splat indices hidden via select + delete (opacity zeroed in viewer). */
  deletedSplatIndices?: number[];
  updatedAt: string;
};

export const DEFAULT_TRANSFORM: SplatTransformEdit = {
  position: [0, 0, 0],
  rotation: [0, 0, 0],
  scale: [1, 1, 1],
};

export function deskIdFromSceneKey(sceneKey: string): string | null {
  const m = sceneKey.match(/\/scenes\/(desk[123])\//);
  return m?.[1] ?? null;
}
