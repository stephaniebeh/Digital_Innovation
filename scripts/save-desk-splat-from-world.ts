/**
 * Copy a finished Aholo job into public/scenes/{desk}/ for the desk demo.
 * Use the worldId shown after "Reconstruct with Aholo" succeeds.
 *
 * Usage: npx tsx scripts/save-desk-splat-from-world.ts desk1 <worldId>
 */
import { existsSync, readFileSync, unlinkSync } from "fs";
import { join } from "path";
import { downloadAholoModelToFile } from "../src/lib/aholo/download-model";
import { pickAholoModelUrl } from "../src/lib/aholo/model-url";
import { getWorldDetail } from "../src/lib/aholo/world";

function loadEnvLocal(): void {
  const path = join(process.cwd(), ".env.local");
  if (!existsSync(path)) {
    throw new Error("Missing .env.local — add AHOLO_API_KEY");
  }
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
  if (!process.env.AHOLO_API_KEY) {
    throw new Error("AHOLO_API_KEY not set in .env.local");
  }
}

async function main(): Promise<void> {
  loadEnvLocal();
  const desk = process.argv[2] as "desk1" | "desk2" | "desk3";
  const worldId = process.argv[3]?.trim();
  if (desk !== "desk1" && desk !== "desk2" && desk !== "desk3") {
    throw new Error(
      "Usage: npx tsx scripts/save-desk-splat-from-world.ts desk1|desk3|desk2 <worldId>"
    );
  }
  if (!worldId) {
    throw new Error("Missing worldId — copy it from the app after reconstruction succeeds");
  }

  const world = await getWorldDetail(worldId);
  if (world.status !== "SUCCEEDED") {
    throw new Error(`World ${worldId} status is ${world.status}, not SUCCEEDED`);
  }

  const picked = pickAholoModelUrl({
    plyPath: world.assets?.splats?.urls?.plyPath,
    spzPath: world.assets?.splats?.urls?.spzPath,
  });

  const sceneDir = join(process.cwd(), "public", "scenes", desk);
  const ext = picked.format === "spz" ? "spz" : "ply";
  const outPath = join(sceneDir, `scene-splat.${ext}`);

  console.log(`Downloading ${ext.toUpperCase()} from job ${worldId} → ${outPath}`);
  await downloadAholoModelToFile(picked.url, outPath);

  const legacyPly = join(sceneDir, "scene-splat.ply");
  const legacySpz = join(sceneDir, "scene-splat.spz");
  if (ext === "spz" && existsSync(legacyPly)) {
    unlinkSync(legacyPly);
    console.log("Removed stale scene-splat.ply");
  }
  if (ext === "ply" && existsSync(legacySpz)) {
    unlinkSync(legacySpz);
    console.log("Removed stale scene-splat.spz");
  }

  console.log(`Done. Hard-refresh the desk demo — ${desk} now uses this reconstruction.`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
