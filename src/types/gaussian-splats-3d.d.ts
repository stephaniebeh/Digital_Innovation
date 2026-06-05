declare module "@mkkellogg/gaussian-splats-3d" {

  import type { Camera, Object3D, Scene } from "three";



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

        position?: [number, number, number];

        rotation?: [number, number, number, number];

        scale?: [number, number, number];

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

      getSplatColor(index: number, out: import("three").Vector4): void;

      getSplatLocalIndex(index: number): number;

      getSplatBufferForSplat(index: number): unknown;

      getScene(index: number): { splatBuffer: unknown } | null;

      refreshDataTexturesFromSplatBuffers(full: boolean): void;

    };

    raycaster?: {

      setFromCameraAndScreenPosition(

        camera: import("three").Camera,

        screenPosition: import("three").Vector2,

        screenDimensions: import("three").Vector2

      ): void;

      intersectSplatMesh(

        splatMesh: ReturnType<Viewer["getSplatMesh"]>,

        outHits?: Array<{ splatIndex: number }>

      ): Array<{ splatIndex: number }>;

    };

    camera?: Camera;

    controls?: { enabled: boolean; target: import("three").Vector3; update: () => void };

    threeScene?: Scene;

    forceRenderNextFrame?: () => void;

  }

}


