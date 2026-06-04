export type AholoModelFormat = "ply" | "spz";

/** Prefer SPZ (Aholo’s compressed export), then PLY. */
export function pickAholoModelUrl(result: {
  modelUrl?: string | null;
  plyPath?: string;
  spzPath?: string;
  lodMetaPath?: string;
}): { url: string; format: AholoModelFormat } {
  if (result.spzPath) {
    return { url: result.spzPath, format: "spz" };
  }
  if (result.plyPath) {
    return { url: result.plyPath, format: "ply" };
  }
  const fallback = result.modelUrl;
  if (fallback) {
    const lower = fallback.toLowerCase();
    if (lower.includes(".ply")) return { url: fallback, format: "ply" };
    if (lower.includes(".spz")) return { url: fallback, format: "spz" };
    if (lower.includes("lodmeta") || lower.includes("lod_meta")) {
      throw new Error(
        "Reconstruction only returned LOD metadata — ply/spz not ready yet. Wait and retry."
      );
    }
    return { url: fallback, format: "spz" };
  }
  throw new Error("Reconstruction succeeded but no ply or spz URL was returned");
}

export function proxyModelUrl(
  remoteUrl: string,
  format: AholoModelFormat
): string {
  return `/api/model?url=${encodeURIComponent(remoteUrl)}&ext=${format}`;
}

export function inferFormatFromProxyUrl(
  proxyUrl: string
): AholoModelFormat | null {
  try {
    const ext = new URL(proxyUrl, "http://localhost").searchParams.get("ext");
    if (ext === "ply" || ext === "spz") return ext;
  } catch {
    /* relative url */
  }
  const match = proxyUrl.match(/[?&]ext=(ply|spz)/);
  if (match) return match[1] as AholoModelFormat;
  const lower = proxyUrl.toLowerCase();
  if (lower.includes(".ply")) return "ply";
  if (lower.includes(".spz")) return "spz";
  return null;
}

export async function probeProxiedModel(proxyUrl: string): Promise<void> {
  const res = await fetch(proxyUrl, { method: "GET" });
  if (!res.ok) {
    let detail = `HTTP ${res.status}`;
    try {
      const json = await res.json();
      detail = (json.details as string) || (json.error as string) || detail;
    } catch {
      /* binary error body */
    }
    throw new Error(`Model download failed: ${detail}`);
  }
  const len = res.headers.get("content-length");
  if (len === "0") {
    throw new Error("Model file is empty");
  }
}
