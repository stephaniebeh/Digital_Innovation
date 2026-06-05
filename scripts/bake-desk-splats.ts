/**
 * Bake public/scenes/{desk}/scene-splat.{spz|ply} from desk photo folders via Aholo API.
 * Usage: npx tsx scripts/bake-desk-splats.ts [desk1|desk2|all] [--images N]
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

function parseArgs(): {
  desks: ("desk1" | "desk2" | "desk3")[];
  imageLimit: number | null;
} {
  const argv = process.argv.slice(2);
  let deskArg = "all";
  /** null = every image in desk1 images / desk2 images (or dense fallback) */
  let imageLimit: number | null = null;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--images" && argv[i + 1]) {
      const n = Number(argv[++i]);
      if (!Number.isFinite(n) || n < MIN_RECONSTRUCTION_IMAGES) {
        throw new Error(
          `--images must be at least ${MIN_RECONSTRUCTION_IMAGES} (got ${argv[i] ?? n})`
        );
      }
      imageLimit = n;
    } else if (!argv[i].startsWith("-")) {
      deskArg = argv[i];
    }
  }
  const ALL_DESKS = ["desk1", "desk3", "desk2"] as const;
  type DeskId = (typeof ALL_DESKS)[number];
  const isDesk = (d: string): d is DeskId =>
    ALL_DESKS.includes(d as DeskId);

  const desks: DeskId[] =
    deskArg === "all" ? [...ALL_DESKS] : isDesk(deskArg) ? [deskArg] : [];
  if (desks.length === 0) {
    throw new Error(
      "Usage: npx tsx scripts/bake-desk-splats.ts [desk1|desk3|desk2|all] [--images N]\n" +
        "  Default: all photos from deskN/deskN images folders.\n" +
        "  --images N = optional cap with even sampling (quick tests only)."
    );
  }
  return { desks, imageLimit };
}

function resolveImageDir(desk: string): string {
  const candidates = [
    join(process.cwd(), desk, `${desk} images`),
    join(process.cwd(), desk, "dense", "0", "images"),
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
    `No image folder with ${MIN_RECONSTRUCTION_IMAGES}+ photos for ${desk}. ` +
      `Expected "${desk}/${desk} images" or "${desk}/dense/0/images".`
  );
}

function listDeskImages(desk: string, imageLimit: number | null): string[] {
  const dir = resolveImageDir(desk);
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

async function bakeDesk(
  desk: "desk1" | "desk2" | "desk3",
  imageLimit: number | null
): Promise<void> {
  const images = listDeskImages(desk, imageLimit);
  const sceneDir = join(process.cwd(), "public", "scenes", desk);

  console.log(
    `\n=== ${desk}: uploading ${images.length} images (taskQuality=high) to Aholo ===`
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

  console.log(`Creating reconstruction for ${desk}...`);
  const { worldId } = await createReconstruction({
    name: `afterimage-${desk}`,
    scene: "space",
    taskQuality: "high",
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
      throw new Error(`Reconstruction ${world.status} for ${desk}`);
    }
  }

  if (!remoteUrl) {
    throw new Error(`Timed out waiting for ${desk} reconstruction`);
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
  const { desks, imageLimit } = parseArgs();

  for (const desk of desks) {
    await bakeDesk(desk, imageLimit);
  }

  console.log("\nDone. Reload the desk demo in the browser.");
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
