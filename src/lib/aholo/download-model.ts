import { mkdirSync, writeFileSync } from "fs";
import { dirname } from "path";
import { getAholoHeaders } from "./config";

export async function downloadAholoModelToFile(
  remoteUrl: string,
  outPath: string
): Promise<void> {
  const res = await fetch(remoteUrl, { headers: getAholoHeaders() });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Download failed (${res.status}): ${text.slice(0, 200)}`);
  }
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length < 4096) {
    throw new Error(
      `Downloaded file too small (${buf.length} bytes) — not a valid splat`
    );
  }
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, buf);
}
