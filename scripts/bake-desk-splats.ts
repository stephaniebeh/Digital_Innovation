/**
 * Bake public/scenes/{sceneId}/scene-splat.{spz|ply} from photo folders via Aholo API.
 * Usage: npx tsx scripts/bake-desk-splats.ts [desk1|dininghall1|all|dininghall] [--images N]
 */
import { existsSync, readdirSync, readFileSync, unlinkSync } from "fs";
import { extname, join } from "path";
import { MIN_RECONSTRUCTION_IMAGES } from "../src/lib/aholo/config";
import { downloadAholoModelToFile } from "../src/lib/aholo/download-model";
import { pickAholoModelUrl } from "../src/lib/aholo/model-url";
import { uploadFileToOus } from "../src/lib/aholo/upload";
import { createReconstruction, getWorldDetail } from "../src/lib/aholo/world";

const POLL_MS = 5000;
/** Large photo sets (200+) need longer upload + reconstruction */
const TIMEOUT_MS = 3 * 60 * 60 * 1000;
const IMAGE_EXT = new Set([".jpg", ".jpeg", ".png", ".webp"]);

function loadEnvLocal(): void {
  const path = join(process.cwd(), ".env.local");
  if (!existsSync(path)) {
    throw new Error("Missing .env.local — add AHOLO_API_KEY from Aholo Labs");
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

const ALL_DESKS = ["desk1", "desk3", "desk2"] as const;
const ALL_DINING = ["dininghall1", "dininghall2"] as const;
const ALL_SCENES = [...ALL_DESKS, ...ALL_DINING] as const;
type SceneId = (typeof ALL_SCENES)[number];

const SCENE_ALIASES: Record<string, SceneId[]> = {
  all: [...ALL_DESKS],
  dininghall: [...ALL_DINING],
  "dining-hall": [...ALL_DINING],
};

function parseArgs(): {
  scenes: SceneId[];
  imageLimit: number | null;
  taskQuality: "low" | "normal" | "high";
} {
  const argv = process.argv.slice(2);
  const sceneArgs: string[] = [];
  /** null = every image in the scene folder */
  let imageLimit: number | null = null;
  let taskQuality: "low" | "normal" | "high" = "high";
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--images" && argv[i + 1]) {
      const n = Number(argv[++i]);
      if (!Number.isFinite(n) || n < MIN_RECONSTRUCTION_IMAGES) {
        throw new Error(
          `--images must be at least ${MIN_RECONSTRUCTION_IMAGES} (got ${argv[i] ?? n})`
        );
      }
      imageLimit = n;
    } else if (argv[i] === "--quality" && argv[i + 1]) {
      const q = argv[++i] as "low" | "normal" | "high";
      if (!["low", "normal", "high"].includes(q)) {
        throw new Error("--quality must be low, normal, or high");
      }
      taskQuality = q;
    } else if (!argv[i].startsWith("-")) {
      sceneArgs.push(argv[i]);
    }
  }

  const isScene = (d: string): d is SceneId =>
    ALL_SCENES.includes(d as SceneId);

  const requested = sceneArgs.length ? sceneArgs : ["all"];
  const scenes: SceneId[] = [];
  for (const arg of requested) {
    const alias = SCENE_ALIASES[arg];
    if (alias) {
      scenes.push(...alias);
      continue;
    }
    if (isScene(arg)) {
      scenes.push(arg);
      continue;
    }
    throw new Error(
      "Usage: npx tsx scripts/bake-desk-splats.ts [desk1|dininghall1|all|dininghall] [--images N]\n" +
        "  Default (no args): desk1, desk3, desk2.\n" +
        "  dininghall = dininghall1 + dininghall2 from images/ folders.\n" +
        "  --images N = optional cap with even sampling (quick tests only)."
    );
  }

  return { scenes: [...new Set(scenes)], imageLimit, taskQuality };
}

function resolveImageDir(sceneId: string): string {
  const candidates = [
    join(process.cwd(), "images", sceneId),
    join(process.cwd(), sceneId, `${sceneId} images`),
    join(process.cwd(), sceneId, "dense", "0", "images"),
  ];
  for (const dir of candidates) {
    if (existsSync(dir)) {
      const count = readdirSync(dir).filter((f) =>
        IMAGE_EXT.has(extname(f).toLowerCase())
      ).length;
      if (count >= MIN_RECONSTRUCTION_IMAGES) {
        console.log(`Using ${count} photos from ${dir}`);
        return dir;
      }
    }
  }
  throw new Error(
    `No image folder with ${MIN_RECONSTRUCTION_IMAGES}+ photos for ${sceneId}. ` +
      `Expected "images/${sceneId}", "${sceneId}/${sceneId} images", or "${sceneId}/dense/0/images".`
  );
}

function listSceneImages(sceneId: string, imageLimit: number | null): string[] {
  const dir = resolveImageDir(sceneId);
  const all = readdirSync(dir)
    .filter((f) => IMAGE_EXT.has(extname(f).toLowerCase()))
    .sort();

  if (all.length < MIN_RECONSTRUCTION_IMAGES) {
    throw new Error(
      `Need at least ${MIN_RECONSTRUCTION_IMAGES} images in ${dir}, found ${all.length}`
    );
  }

  if (imageLimit === null || imageLimit >= all.length) {
    return all.map((f) => join(dir, f));
  }

  const picked: string[] = [];
  for (let i = 0; i < imageLimit; i++) {
    const idx =
      imageLimit === 1
        ? 0
        : Math.round((i / (imageLimit - 1)) * (all.length - 1));
    picked.push(join(dir, all[idx]));
  }
  console.log(`  (sampling ${imageLimit} of ${all.length} — omit --images to use all)`);
  return picked;
}

async function bakeScene(
  sceneId: SceneId,
  imageLimit: number | null,
  taskQuality: "low" | "normal" | "high"
): Promise<void> {
  const images = listSceneImages(sceneId, imageLimit);
  const sceneDir = join(process.cwd(), "public", "scenes", sceneId);

  console.log(
    `\n=== ${sceneId}: uploading ${images.length} images (taskQuality=${taskQuality}) to Aholo ===`
  );

  const urls: string[] = [];
  for (let i = 0; i < images.length; i++) {
    const filePath = images[i];
    const buffer = readFileSync(filePath);
    const ext = extname(filePath) || ".jpg";
    const filename = `frame_${String(i).padStart(5, "0")}${ext}`;
    urls.push(await uploadFileToOus(buffer, filename));
    console.log(`  uploaded ${i + 1}/${images.length}`);
  }

  console.log(`Creating reconstruction for ${sceneId}...`);
  const { worldId } = await createReconstruction({
    name: `afterimage-${sceneId}`,
    scene: "space",
    taskQuality,
    cover: urls[0],
    resources: urls.map((url) => ({ url, type: "image" as const })),
  });
  console.log(`worldId: ${worldId}`);

  const deadline = Date.now() + TIMEOUT_MS;
  let remoteUrl: string | null = null;
  let format: "ply" | "spz" = "ply";

  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, POLL_MS));
    const world = await getWorldDetail(worldId);
    console.log(`  status: ${world.status}`);

    if (world.status === "SUCCEEDED") {
      const picked = pickAholoModelUrl({
        plyPath: world.assets?.splats?.urls?.plyPath,
        spzPath: world.assets?.splats?.urls?.spzPath,
      });
      remoteUrl = picked.url;
      format = picked.format;
      break;
    }
    if (world.status === "FAILED" || world.status === "CANCELED") {
      throw new Error(
        `Reconstruction ${world.status} for ${sceneId} (worldId: ${worldId}). ` +
          `Try fewer photos (--images 40), --quality low, or a steadier photo set with more overlap.`
      );
    }
  }

  if (!remoteUrl) {
    throw new Error(`Timed out waiting for ${sceneId} reconstruction`);
  }

  const ext = format === "spz" ? "spz" : "ply";
  const outPath = join(sceneDir, `scene-splat.${ext}`);
  const legacyPly = join(sceneDir, "scene-splat.ply");

  console.log(`Downloading ${ext.toUpperCase()} splat to ${outPath}...`);
  await downloadAholoModelToFile(remoteUrl, outPath);
  const mb = (readFileSync(outPath).length / (1024 * 1024)).toFixed(1);
  console.log(`Saved ${outPath} (${mb} MB)`);

  if (ext === "spz" && existsSync(legacyPly)) {
    try {
      unlinkSync(legacyPly);
      console.log("Removed old scene-splat.ply (replaced by .spz)");
    } catch {
      /* ignore */
    }
  }
  if (ext === "ply" && existsSync(join(sceneDir, "scene-splat.spz"))) {
    try {
      unlinkSync(join(sceneDir, "scene-splat.spz"));
    } catch {
      /* ignore */
    }
  }
}

async function main(): Promise<void> {
  loadEnvLocal();
  const { scenes, imageLimit, taskQuality } = parseArgs();

  for (const sceneId of scenes) {
    await bakeScene(sceneId, imageLimit, taskQuality);
  }

  console.log("\nDone. Reload the viewer in the browser.");
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
