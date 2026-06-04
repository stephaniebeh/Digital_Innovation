declare module "@mkkellogg/gaussian-splats-3d" {
  import type { Object3D } from "three";

  export const SceneFormat: {
    Splat: number;
    KSplat: number;
    Ply: number;
    Spz: number;
  };

  export const SceneRevealMode: {
    Default: number;
    Gradual: number;
    Instant: number;
  };

  export class Viewer {
    constructor(options: Record<string, unknown>);
    addSplatScene(
      url: string,
      options?: {
        format?: number;
        splatAlphaRemovalThreshold?: number;
        showLoadingUI?: boolean;
        progressiveLoad?: boolean;
        [key: string]: unknown;
      }
    ): Promise<void>;
    start(): void;
    stop(): void;
    dispose(): void | Promise<void>;
    getSceneCount(): number;
    getSplatScene(index: number): Object3D & { visible: boolean; opacity: number };
    getSplatMesh(): {
      getSplatCount(): number;
      getSplatCenter(
        index: number,
        out: import("three").Vector3,
        applySceneTransform?: boolean
      ): void;
    };
  }
}
