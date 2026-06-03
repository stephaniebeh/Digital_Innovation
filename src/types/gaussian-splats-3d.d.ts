declare module "@mkkellogg/gaussian-splats-3d" {
  export const SceneFormat: {
    Splat: number;
    KSplat: number;
    Ply: number;
    Spz: number;
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
    dispose(): void;
  }
}
