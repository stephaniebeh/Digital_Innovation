/** Release focus from the memory timeline slider so arrow keys orbit the scene. */
export function blurTimelineRangeIfFocused(): void {
  const el = document.activeElement;
  if (el instanceof HTMLInputElement && el.type === "range") {
    el.blur();
  }
}

/** Clear DOM nodes added by WebGL / splat viewers without fighting React. */
export function clearViewerHost(element: HTMLElement | null): void {
  if (!element?.isConnected) return;
  try {
    for (const canvas of element.querySelectorAll("canvas")) {
      const gl = canvas.getContext("webgl2") ?? canvas.getContext("webgl");
      gl?.getExtension("WEBGL_lose_context")?.loseContext();
    }
    element.replaceChildren();
  } catch {
    /* React or the splat library may already have torn down this subtree */
  }
}

type SplatViewerInstance = {
  stop?: () => void;
  dispose?: () => void | Promise<void>;
  renderer?: { domElement: HTMLCanvasElement; setSize: (w: number, h: number, updateStyle?: boolean) => void };
};

type SizedViewer = SplatViewerInstance & {
  forceRenderNextFrame?: () => void;
};

/**
 * Wait until the host has real layout (avoids tiny canvas stuck at bottom of page).
 */
export async function waitForHostLayout(
  host: HTMLElement,
  minSize = 200
): Promise<void> {
  for (let i = 0; i < 150; i++) {
    if (host.offsetWidth >= minSize && host.offsetHeight >= minSize) return;
    await new Promise<void>((r) => requestAnimationFrame(() => r()));
  }
}

/** Force WebGL canvas to fill the host after load or window resize. */
export function syncViewerCanvasSize(
  viewer: SplatViewerInstance | null | undefined,
  host: HTMLElement
): void {
  const v = viewer as SizedViewer | null | undefined;
  if (!v?.renderer) return;

  const w = host.clientWidth;
  const h = host.clientHeight;
  if (w < 2 || h < 2) return;

  v.renderer.setSize(w, h, true);
  const canvas = v.renderer.domElement;
  canvas.style.display = "block";
  canvas.style.position = "absolute";
  canvas.style.inset = "0";
  canvas.style.width = "100%";
  canvas.style.height = "100%";
  v.forceRenderNextFrame?.();
}

/**
 * Tear down a gaussian-splats Viewer without calling dispose().
 * dispose() always runs document.body.removeChild(rootElement), which breaks when
 * rootElement is a React-managed host (NotFoundError / blank screen).
 */
export function teardownSplatViewer(
  viewer: SplatViewerInstance | null | undefined
): void {
  if (!viewer) return;
  try {
    viewer.stop?.();
  } catch {
    /* ignore */
  }
}

/** @deprecated Use teardownSplatViewer */
export function safeDisposeViewer(viewer: SplatViewerInstance | null | undefined): void {
  teardownSplatViewer(viewer);
}
