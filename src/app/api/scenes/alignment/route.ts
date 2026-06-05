import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { NextResponse } from "next/server";
import type { SceneAlignmentState } from "@/lib/scene-alignment";

const ALIGNMENT_PATH = join(
  process.cwd(),
  "public",
  "scenes",
  "scene-alignment.json"
);

export async function POST(req: Request) {
  let alignment: SceneAlignmentState;
  try {
    alignment = (await req.json()) as SceneAlignmentState;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!alignment?.desk1 || !alignment?.desk2 || !alignment?.desk3) {
    return NextResponse.json({ error: "Invalid alignment payload" }, { status: 400 });
  }

  const sceneDir = join(process.cwd(), "public", "scenes");
  if (!existsSync(sceneDir)) {
    mkdirSync(sceneDir, { recursive: true });
  }

  writeFileSync(ALIGNMENT_PATH, JSON.stringify(alignment, null, 2), "utf8");

  return NextResponse.json({
    ok: true,
    path: "/scenes/scene-alignment.json",
  });
}

export async function GET() {
  if (!existsSync(ALIGNMENT_PATH)) {
    return NextResponse.json({ alignment: null });
  }

  const alignment = JSON.parse(
    readFileSync(ALIGNMENT_PATH, "utf8")
  ) as SceneAlignmentState;
  return NextResponse.json({ alignment });
}
