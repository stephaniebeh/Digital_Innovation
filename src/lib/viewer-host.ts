/** Clear DOM nodes added by WebGL / splat viewers without fighting React. */
export function clearViewerHost(element: HTMLElement | null): void {
  if (!element) return;
  try {
    element.replaceChildren();
  } catch {
    while (element.firstChild) {
      element.removeChild(element.firstChild);
    }
  }
}

export function safeDisposeViewer(
  viewer: { dispose?: () => void } | null | undefined
): void {
  if (!viewer?.dispose) return;
  try {
    viewer.dispose();
  } catch {
    /* gaussian-splats may already have torn down the DOM */
  }
}
