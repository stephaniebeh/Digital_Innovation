/** Parse Aholo gateway JSON (ApiError / WorldAsyncOperation / WorldDetail). */

export type AholoApiError = {
  code?: number;
  message?: string;
  status?: string;
  details?: {
    reason?: string;
    message?: string;
    metaData?: { bizCode?: string };
  };
};

export function parseApiError(
  data: Record<string, unknown>,
  httpStatus: number
): string {
  const msg =
    (data.message as string) ||
    (data.details as AholoApiError["details"])?.message ||
    `Request failed (${httpStatus})`;
  const biz =
    (data.details as AholoApiError["details"])?.metaData?.bizCode ??
    (data.details as AholoApiError["details"])?.reason;
  return biz ? `${msg} (bizCode: ${biz})` : msg;
}

export function extractWorldId(data: Record<string, unknown>): string | null {
  if (typeof data.worldId === "string" && data.worldId) {
    return data.worldId;
  }
  for (const key of ["data", "d", "result"] as const) {
    const nested = data[key];
    if (nested && typeof nested === "object") {
      const id = (nested as Record<string, unknown>).worldId;
      if (typeof id === "string" && id) return id;
    }
  }
  return null;
}

export function unwrapGatewayBody<T extends Record<string, unknown>>(
  data: T
): T {
  if (typeof data.worldId === "string" || typeof data.status === "string") {
    return data;
  }
  const nested = data.data ?? data.d;
  if (nested && typeof nested === "object") {
    return nested as T;
  }
  return data;
}

export type NormalizedSplatUrls = {
  plyPath?: string;
  spzPath?: string;
  lodMetaPath?: string;
};

/** Docs: assets.splats.urls.{plyPath,spzPath,lodMetaPath} */
export function extractSplatUrls(
  assets: unknown
): NormalizedSplatUrls | undefined {
  if (!assets || typeof assets !== "object") return undefined;

  const splats = (assets as Record<string, unknown>).splats;
  if (!splats || typeof splats !== "object") return undefined;

  const s = splats as Record<string, unknown>;
  const urls = s.urls;
  if (urls && typeof urls === "object") {
    const u = urls as Record<string, unknown>;
    return {
      plyPath: typeof u.plyPath === "string" ? u.plyPath : undefined,
      spzPath: typeof u.spzPath === "string" ? u.spzPath : undefined,
      lodMetaPath:
        typeof u.lodMetaPath === "string" ? u.lodMetaPath : undefined,
    };
  }

  return {
    plyPath: typeof s.plyPath === "string" ? s.plyPath : undefined,
    spzPath: typeof s.spzPath === "string" ? s.spzPath : undefined,
    lodMetaPath:
      typeof s.lodMetaPath === "string" ? s.lodMetaPath : undefined,
  };
}
