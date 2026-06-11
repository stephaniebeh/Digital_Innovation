/** Browser-side helpers for /api/reconstruct and /api/world */

export const MIN_RECONSTRUCTION_IMAGES = 20;

const POLL_INTERVAL_MS = 4000;
const POLL_TIMEOUT_MS = 45 * 60 * 1000;

export type WorldPollResult = {
  worldId: string;
  status: string;
  createTime?: number;
  updateTime?: number;
  modelUrl: string | null;
  plyPath?: string;
  spzPath?: string;
  lodMetaPath?: string;
  modelFormat?: string;
};

export type WorldStatusUpdate = Pick<
  WorldPollResult,
  "status" | "createTime" | "updateTime"
>;

import {
  pickAholoModelUrl,
  proxyModelUrl,
  probeProxiedModel,
} from "./model-url";

export { pickAholoModelUrl, proxyModelUrl, probeProxiedModel } from "./model-url";
export type { AholoModelFormat } from "./model-url";

export async function startReconstruction(
  files: FileList | File[],
  options?: {
    name?: string;
    scene?: "model" | "space";
    taskQuality?: "low" | "normal" | "high";
    onUploadProgress?: (ratio: number) => void;
  }
): Promise<{ worldId: string; imageCount: number }> {
  const form = new FormData();
  const list = Array.isArray(files) ? files : Array.from(files);
  for (const file of list) {
    form.append("files", file);
  }
  if (options?.name) form.append("name", options.name);
  form.append("scene", options?.scene ?? "space");
  form.append("taskQuality", options?.taskQuality ?? "normal");

  const data = await new Promise<Record<string, unknown>>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/reconstruct");
    xhr.responseType = "json";

    xhr.upload.addEventListener("progress", (event) => {
      if (!event.lengthComputable) return;
      options?.onUploadProgress?.(event.loaded / event.total);
    });

    xhr.addEventListener("load", () => {
      const body =
        xhr.response && typeof xhr.response === "object"
          ? (xhr.response as Record<string, unknown>)
          : {};
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(body);
        return;
      }
      const msg =
        (body.details as string) ||
        (body.error as string) ||
        `Reconstruction request failed (${xhr.status})`;
      reject(new Error(msg));
    });

    xhr.addEventListener("error", () => {
      reject(new Error("Reconstruction request failed (network error)"));
    });

    xhr.send(form);
  });

  if (!data.worldId) {
    throw new Error("Server did not return a worldId");
  }

  return {
    worldId: data.worldId as string,
    imageCount: data.imageCount as number,
  };
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
    createTime: data.createTime as number | undefined,
    updateTime: data.updateTime as number | undefined,
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
    onStatus?: (update: WorldStatusUpdate) => void;
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
    onStatus?: (update: WorldStatusUpdate) => void;
    shouldAbort?: () => boolean;
  }
): Promise<WorldPollResult> {
  const started = Date.now();

  while (Date.now() - started < POLL_TIMEOUT_MS) {
    if (options?.shouldAbort?.()) {
      throw new Error("Polling cancelled");
    }

    const result = await fetchWorldStatus(worldId);
    options?.onStatus?.({
      status: result.status,
      createTime: result.createTime,
      updateTime: result.updateTime,
    });

    if (result.status === "SUCCEEDED") {
      try {
        pickAholoModelUrl({
          modelUrl: result.modelUrl,
          plyPath: result.plyPath,
          spzPath: result.spzPath,
        });
        return result;
      } catch {
        options?.onStatus?.({
          status: "SUCCEEDED — waiting for ply/spz assets",
        });
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
