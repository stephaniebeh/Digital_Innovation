export async function readResponseJson<T>(
  res: Response,
  context: string
): Promise<T> {
  const text = await res.text();
  const trimmed = text.trimStart();

  if (!trimmed) {
    throw new Error(`${context}: empty response (${res.status})`);
  }

  if (trimmed.startsWith("<")) {
    throw new Error(
      `${context}: expected JSON but received HTML (${res.status}). ` +
        `Check the request URL and auth. Preview: ${trimmed.slice(0, 160)}`
    );
  }

  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(
      `${context}: invalid JSON (${res.status}): ${text.slice(0, 200)}`
    );
  }
}

export function normalizeGlobalDomain(domain: string): string {
  let normalized = domain.trim().replace(/\/$/, "");

  if (!normalized.startsWith("http://") && !normalized.startsWith("https://")) {
    normalized = `https://${normalized}`;
  }

  // Docs: call /ous/api/... on globalDomain host only (no extra /global prefix).
  normalized = normalized.replace(/\/global$/, "");

  return normalized;
}
