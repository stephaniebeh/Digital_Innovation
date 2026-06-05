/**
 * Poll Aholo until a world succeeds, then save to public/scenes/{desk}/.
 * Usage: npx tsx scripts/wait-and-save-desk-splat.ts desk3 3FO4K4VFO9XK
 */
import { existsSync, readFileSync, unlinkSync } from "fs";
import { join } from "path";
import { downloadAholoModelToFile } from "../src/lib/aholo/download-model";
import { pickAholoModelUrl } from "../src/lib/aholo/model-url";
import { getWorldDetail } from "../src/lib/aholo/world";

const POLL_MS = 5000;
const TIMEOUT_MS = 3 * 60 * 60 * 1000;

function loadEnvLocal(): void {
  const path = join(process.cwd(), ".env.local");
  if (!existsSync(path)) throw new Error("Missing .env.local");
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = val;
  }
}

async function main(): Promise<void> {
  loadEnvLocal();
  const desk = process.argv[2] as "desk1" | "desk2" | "desk3";
  const worldId = process.argv[3]?.trim();
  if (!desk || !worldId) {
    throw new Error(
      "Usage: npx tsx scripts/wait-and-save-desk-splat.ts desk1|desk3|desk2 <worldId>"
    );
  }

  const deadline = Date.now() + TIMEOUT_MS;
  while (Date.now() < deadline) {
    const world = await getWorldDetail(worldId);
    console.log(`  ${worldId} · ${world.status}`);
    if (world.status === "SUCCEEDED") {
      const picked = pickAholoModelUrl({
        plyPath: world.assets?.splats?.urls?.plyPath,
        spzPath: world.assets?.splats?.urls?.spzPath,
      });
      const sceneDir = join(process.cwd(), "public", "scenes", desk);
      const ext = picked.format === "spz" ? "spz" : "ply";
      const outPath = join(sceneDir, `scene-splat.${ext}`);
      console.log(`Downloading → ${outPath}`);
      await downloadAholoModelToFile(picked.url, outPath);
      const legacyPly = join(sceneDir, "scene-splat.ply");
      const legacySpz = join(sceneDir, "scene-splat.spz");
      if (ext === "spz" && existsSync(legacyPly)) unlinkSync(legacyPly);
      if (ext === "ply" && existsSync(legacySpz)) unlinkSync(legacySpz);
      console.log("Done. Hard-refresh the desk demo.");
      return;
    }
    if (world.status === "FAILED" || world.status === "CANCELED") {
      throw new Error(`Job ${world.status}`);
    }
    await new Promise((r) => setTimeout(r, POLL_MS));
  }
  throw new Error("Timed out waiting for reconstruction");
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
