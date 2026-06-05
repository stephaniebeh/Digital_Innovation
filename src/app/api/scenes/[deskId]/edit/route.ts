import { existsSync, mkdirSync, writeFileSync } from "fs";
import { join } from "path";
import { NextResponse } from "next/server";
import type { SplatSceneEdit } from "@/lib/splat-editor/types";

const DESK_IDS = new Set(["desk1", "desk2", "desk3"]);

export async function POST(
  req: Request,
  { params }: { params: Promise<{ deskId: string }> }
) {
  const { deskId } = await params;
  if (!DESK_IDS.has(deskId)) {
    return NextResponse.json({ error: "Invalid desk id" }, { status: 400 });
  }

  let edit: SplatSceneEdit;
  try {
    edit = (await req.json()) as SplatSceneEdit;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const sceneDir = join(process.cwd(), "public", "scenes", deskId);
  if (!existsSync(sceneDir)) {
    mkdirSync(sceneDir, { recursive: true });
  }

  const outPath = join(sceneDir, "scene-edit.json");
  writeFileSync(outPath, JSON.stringify(edit, null, 2), "utf8");

  return NextResponse.json({ ok: true, path: `/scenes/${deskId}/scene-edit.json` });
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ deskId: string }> }
) {
  const { deskId } = await params;
  if (!DESK_IDS.has(deskId)) {
    return NextResponse.json({ error: "Invalid desk id" }, { status: 400 });
  }

  const path = join(process.cwd(), "public", "scenes", deskId, "scene-edit.json");
  if (!existsSync(path)) {
    return NextResponse.json({ edit: null });
  }

  const { readFileSync } = await import("fs");
  const edit = JSON.parse(readFileSync(path, "utf8")) as SplatSceneEdit;
  return NextResponse.json({ edit });
}
