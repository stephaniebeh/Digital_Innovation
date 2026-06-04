"use client";

import { useEffect, useState } from "react";
import {
  DEMO_SPLAT_SETUP_HINT,
  resolveSplatUrl,
} from "@/lib/demo-scenes";
import ViewerErrorPanel from "@/components/ViewerErrorPanel";
import type { AholoModelFormat } from "@/lib/aholo/model-url";
import { splatFormatFromUrl } from "@/lib/splat-viewer-config";
import type { SceneAlignmentState } from "@/lib/scene-alignment";
import dynamic from "next/dynamic";

const TimelineSplatViewer = dynamic(
  () => import("@/components/TimelineSplatViewer"),
  { ssr: false }
);

const AholoSplatViewer = dynamic(
  () => import("@/components/AholoSplatViewer"),
  { ssr: false }
);

type DeskSplatAssets = {
  primaryUrl: string;
  secondaryUrl: string;
  primaryFormat: AholoModelFormat;
  secondaryFormat: AholoModelFormat;
};

type Props = {
  primarySplatUrl: string;
  secondarySplatUrl: string;
  blend: number;
  alignment: SceneAlignmentState;
  overlayBoth: boolean;
  aholoSplatUrl?: string | null;
  aholoModelFormat?: AholoModelFormat;
  sourceLabel?: string;
};

export default function SceneViewer({
  primarySplatUrl,
  secondarySplatUrl,
  blend,
  alignment: _alignment,
  overlayBoth,
  aholoSplatUrl = null,
  aholoModelFormat = "ply",
  sourceLabel,
}: Props) {
  const [deskReady, setDeskReady] = useState<boolean | null>(null);
  const [deskAssets, setDeskAssets] = useState<DeskSplatAssets | null>(null);
  const [viewerError, setViewerError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function resolve() {
      setViewerError(null);
      setDeskAssets(null);

      if (aholoSplatUrl) {
        setDeskReady(true);
        return;
      }

      const [primarySplat, secondarySplat] = await Promise.all([
        resolveSplatUrl(primarySplatUrl),
        resolveSplatUrl(secondarySplatUrl),
      ]);

      if (cancelled) return;

      const missing: string[] = [];
      if (primarySplat.missing) missing.push("desk1/scene-splat");
      if (secondarySplat.missing) missing.push("desk2/scene-splat");

      if (missing.length > 0) {
        setDeskReady(false);
        setViewerError(
          `Missing 3D Gaussian splat file(s): ${missing.join(", ")}. ${DEMO_SPLAT_SETUP_HINT}`
        );
        return;
      }

      setDeskAssets({
        primaryUrl: primarySplat.url,
        secondaryUrl: secondarySplat.url,
        primaryFormat: splatFormatFromUrl(primarySplat.url),
        secondaryFormat: splatFormatFromUrl(secondarySplat.url),
      });
      setDeskReady(true);
    }

    setDeskReady(null);
    resolve();
    return () => {
      cancelled = true;
    };
  }, [primarySplatUrl, secondarySplatUrl, aholoSplatUrl]);

  if (!aholoSplatUrl && deskReady === null) {
    return (
      <div className="absolute inset-0 bg-zinc-950 flex items-center justify-center text-zinc-500 text-sm">
        Loading 3D reconstruction…
      </div>
    );
  }

  if (!aholoSplatUrl && deskReady === false && viewerError) {
    return (
      <ViewerErrorPanel
        title="Splat scenes not ready"
        message={viewerError}
        hint="Re-bake: npm run bake-splats — or copy your good job: npx tsx scripts/save-desk-splat-from-world.ts desk1 <worldId>"
      />
    );
  }

  const badgeLabel =
    sourceLabel ??
    (aholoSplatUrl ? "Aholo reconstruction" : "Desk demo · pre-baked splats");

  return (
    <>
      <div className="absolute top-28 left-4 right-4 z-20 pointer-events-none space-y-1 max-w-md">
        <span
          className={`inline-block text-[10px] uppercase tracking-wider px-2 py-1 rounded-md border ${
            aholoSplatUrl
              ? "border-emerald-200/40 text-emerald-100/90 bg-emerald-950/40"
              : "border-amber-200/40 text-amber-100/90 bg-amber-950/40"
          }`}
        >
          {badgeLabel}
        </span>
        {!aholoSplatUrl && deskReady && (
          <p className="text-[10px] text-zinc-500 leading-snug max-w-sm">
            Uses files in public/scenes/. If this looks worse than a fresh Aholo
            upload, re-bake or save your worldId into desk1/desk2.
          </p>
        )}
      </div>

      {aholoSplatUrl ? (
        <AholoSplatViewer
          key={`${aholoSplatUrl}-${aholoModelFormat}`}
          modelUrl={aholoSplatUrl}
          format={aholoModelFormat}
          onLoadError={setViewerError}
        />
      ) : deskAssets ? (
        <TimelineSplatViewer
          key={`${deskAssets.primaryUrl}|${deskAssets.secondaryUrl}`}
          primaryUrl={deskAssets.primaryUrl}
          secondaryUrl={deskAssets.secondaryUrl}
          primaryFormat={deskAssets.primaryFormat}
          secondaryFormat={deskAssets.secondaryFormat}
          blend={blend}
          overlayBoth={overlayBoth}
          onLoadError={setViewerError}
        />
      ) : null}

      {viewerError && deskReady !== false && !aholoSplatUrl && (
        <ViewerErrorPanel
          title="Could not load scene"
          message={viewerError}
        />
      )}
    </>
  );
}
