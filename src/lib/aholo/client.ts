/** Browser-side helpers for /api/reconstruct and /api/world */

export const MIN_RECONSTRUCTION_IMAGES = 20;

const POLL_INTERVAL_MS = 4000;
const POLL_TIMEOUT_MS = 45 * 60 * 1000;

export type WorldPollResult = {
  worldId: string;
  status: string;
  modelUrl: string | null;
  plyPath?: string;
  spzPath?: string;
  lodMetaPath?: string;
  modelFormat?: string;
};

import {
  pickAholoModelUrl,
  proxyModelUrl,
  probeProxiedModel,
} from "./model-url";

export { pickAholoModelUrl, proxyModelUrl, probeProxiedModel } from "./model-url";
export type { AholoModelFormat } from "./model-url";

export async function startReconstruction(
  files: FileList,
  options?: {
    name?: string;
    scene?: "model" | "space";
    taskQuality?: "low" | "normal" | "high";
  }
): Promise<{ worldId: string; imageCount: number }> {
  const form = new FormData();
  for (let i = 0; i < files.length; i++) {
    form.append("files", files[i]);
  }
  if (options?.name) form.append("name", options.name);
  form.append("scene", options?.scene ?? "space");
  form.append("taskQuality", options?.taskQuality ?? "normal");

  const res = await fetch("/api/reconstruct", { method: "POST", body: form });
  const data = await res.json();

  if (!res.ok) {
    const msg =
      (data.details as string) ||
      (data.error as string) ||
      `Reconstruction request failed (${res.status})`;
    throw new Error(msg);
  }

  if (!data.worldId) {
    throw new Error("Server did not return a worldId");
  }

  return { worldId: data.worldId as string, imageCount: data.imageCount as number };
}

export async function fetchWorldStatus(
  worldId: string
): Promise<WorldPollResult> {
  const res = await fetch(`/api/world/${worldId}`);
  const data = await res.json();

  if (!res.ok) {
    const msg =
      (data.details as string) ||
      (data.error as string) ||
      `Status check failed (${res.status})`;
    throw new Error(msg);
  }

  return {
    worldId: data.worldId as string,
    status: data.status as string,
    modelUrl: (data.modelUrl as string) ?? null,
    plyPath: data.plyPath as string | undefined,
    spzPath: data.spzPath as string | undefined,
    lodMetaPath: data.lodMetaPath as string | undefined,
    modelFormat: data.modelFormat as string | undefined,
  };
}

/** Open an existing Aholo job by worldId (skip re-upload). */
export async function openExistingWorld(
  worldId: string,
  options?: {
    onStatus?: (status: string) => void;
    shouldAbort?: () => boolean;
  }
): Promise<{
  proxiedUrl: string;
  format: import("./model-url").AholoModelFormat;
}> {
  const result = await pollWorldUntilDone(worldId, options);
  const { url, format } = pickAholoModelUrl({
    modelUrl: result.modelUrl,
    plyPath: result.plyPath,
    spzPath: result.spzPath,
    lodMetaPath: result.lodMetaPath,
  });
  const proxied = proxyModelUrl(url, format);
  await probeProxiedModel(proxied);
  return { proxiedUrl: proxied, format };
}

export async function pollWorldUntilDone(
  worldId: string,
  options?: {
    onStatus?: (status: string) => void;
    shouldAbort?: () => boolean;
  }
): Promise<WorldPollResult> {
  const started = Date.now();

  while (Date.now() - started < POLL_TIMEOUT_MS) {
    if (options?.shouldAbort?.()) {
      throw new Error("Polling cancelled");
    }

    const result = await fetchWorldStatus(worldId);
    options?.onStatus?.(result.status);

    if (result.status === "SUCCEEDED") {
      try {
        pickAholoModelUrl({
          modelUrl: result.modelUrl,
          plyPath: result.plyPath,
          spzPath: result.spzPath,
        });
        return result;
      } catch {
        options?.onStatus?.("SUCCEEDED — waiting for ply/spz assets");
        await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
        continue;
      }
    }

    if (result.status === "FAILED" || result.status === "CANCELED") {
      throw new Error(`Reconstruction ${result.status.toLowerCase()}`);
    }

    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
  }

  throw new Error("Reconstruction timed out — check Aholo dashboard or retry");
}
