import { NextResponse } from "next/server";
import { pickAholoModelUrl } from "@/lib/aholo/model-url";
import { getWorldDetail } from "@/lib/aholo/world";

export const runtime = "nodejs";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ worldId: string }> }
) {
  try {
    const { worldId } = await params;
    const world = await getWorldDetail(worldId);

    const splatUrls = world.assets?.splats?.urls;
    let modelUrl: string | null = null;
    let modelFormat: string | null = null;

    if (world.status === "SUCCEEDED") {
      try {
        const picked = pickAholoModelUrl({
          plyPath: splatUrls?.plyPath,
          spzPath: splatUrls?.spzPath,
          lodMetaPath: splatUrls?.lodMetaPath,
        });
        modelUrl = picked.url;
        modelFormat = picked.format;
      } catch {
        modelUrl = null;
      }
    }

    return NextResponse.json({
      worldId: world.worldId,
      name: world.name,
      status: world.status,
      createTime: world.createTime,
      updateTime: world.updateTime,
      modelUrl,
      modelFormat,
      plyPath: splatUrls?.plyPath,
      spzPath: splatUrls?.spzPath,
      lodMetaPath: splatUrls?.lodMetaPath,
    });
  } catch (err) {
    console.error("WORLD STATUS ERROR:", err);
    return NextResponse.json(
      {
        error: "Failed to fetch world status",
        details: err instanceof Error ? err.message : String(err),
      },
      { status: 500 }
    );
  }
}
