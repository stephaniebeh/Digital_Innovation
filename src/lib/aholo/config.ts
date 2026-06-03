export const AHOLO_API_BASE = "https://api.aholo3d.cn";

export const MIN_RECONSTRUCTION_IMAGES = 20;

export function getAholoHeaders(): HeadersInit {
  const apiKey = process.env.AHOLO_API_KEY;
  if (!apiKey) {
    throw new Error("AHOLO_API_KEY is not set");
  }

  const headers: Record<string, string> = {
    Authorization: apiKey,
  };

  const xSource = process.env.AHOLO_X_SOURCE;
  if (xSource) {
    headers["x-source"] = xSource;
  }

  return headers;
}
