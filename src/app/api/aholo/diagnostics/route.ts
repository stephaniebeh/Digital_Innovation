import { NextResponse } from "next/server";
import { getAholoHeaders } from "@/lib/aholo/config";
import { getOusCredentials } from "@/lib/aholo/upload";
import { getWorldDetail } from "@/lib/aholo/world";
import { pickAholoModelUrl } from "@/lib/aholo/model-url";

export const runtime = "nodejs";

/** Quick Aholo API health check (matches Quick Start steps 1–3). */
export async function GET(req: Request) {
  const worldId = new URL(req.url).searchParams.get("worldId");
  const steps: Record<string, unknown> = {};

  try {
    getAholoHeaders();
    steps.apiKey = { ok: true };
  } catch (e) {
    steps.apiKey = {
      ok: false,
      error: e instanceof Error ? e.message : String(e),
    };
    return NextResponse.json({ ok: false, steps }, { status: 500 });
  }

  try {
    const creds = await getOusCredentials();
    steps.ousToken = {
      ok: true,
      globalDomain: creds.globalDomain,
      blockSize: creds.blockSize,
    };
  } catch (e) {
    steps.ousToken = {
      ok: false,
      error: e instanceof Error ? e.message : String(e),
    };
    return NextResponse.json({ ok: false, steps }, { status: 500 });
  }

  if (worldId) {
    try {
      const world = await getWorldDetail(worldId);
      let model: { url: string; format: string } | null = null;
      try {
        const picked = pickAholoModelUrl({
          plyPath: world.assets?.splats?.urls?.plyPath,
          spzPath: world.assets?.splats?.urls?.spzPath,
          lodMetaPath: world.assets?.splats?.urls?.lodMetaPath,
        });
        model = { url: picked.url, format: picked.format };
      } catch (pickErr) {
        model = null;
        steps.modelPick = {
          ok: false,
          error:
            pickErr instanceof Error ? pickErr.message : String(pickErr),
        };
      }

      steps.world = {
        ok: true,
        status: world.status,
        assets: world.assets,
        model,
      };
    } catch (e) {
      steps.world = {
        ok: false,
        error: e instanceof Error ? e.message : String(e),
      };
    }
  }

  const ok =
    (steps.apiKey as { ok: boolean }).ok &&
    (steps.ousToken as { ok: boolean }).ok &&
    (!worldId || (steps.world as { ok?: boolean })?.ok !== false);

  return NextResponse.json({ ok, steps });
}
