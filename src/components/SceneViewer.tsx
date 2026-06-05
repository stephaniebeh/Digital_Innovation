"use client";

import { useEffect, useState } from "react";
import {
  DEMO_SPLAT_SETUP_HINT,
  resolveSplatUrl,
  type TimelineMoment,
} from "@/lib/demo-scenes";
import ViewerErrorPanel from "@/components/ViewerErrorPanel";
import type { AholoModelFormat } from "@/lib/aholo/model-url";
import { splatFormatFromUrl } from "@/lib/splat-viewer-config";
import type { SceneAlignmentState } from "@/lib/scene-alignment";
import dynamic from "next/dynamic";
import type { TimelineSplatLayer } from "@/components/TimelineSplatViewer";

const TimelineSplatViewer = dynamic(
  () => import("@/components/TimelineSplatViewer"),
  { ssr: false }
);

const AholoSplatViewer = dynamic(
  () => import("@/components/AholoSplatViewer"),
  { ssr: false }
);

type Props = {
  timelineMoments: TimelineMoment[];
  timelinePos: number;
  alignment: SceneAlignmentState;
  overlayBoth: boolean;
  aholoSplatUrl?: string | null;
  aholoModelFormat?: AholoModelFormat;
  sourceLabel?: string;
};

export default function SceneViewer({
  timelineMoments,
  timelinePos,
  alignment: _alignment,
  overlayBoth,
  aholoSplatUrl = null,
  aholoModelFormat = "ply",
  sourceLabel,
}: Props) {
  const [deskReady, setDeskReady] = useState<boolean | null>(null);
  const [deskLayers, setDeskLayers] = useState<TimelineSplatLayer[] | null>(
    null
  );
  const [missingDeskIds, setMissingDeskIds] = useState<string[]>([]);
  const [viewerError, setViewerError] = useState<string | null>(null);

  const momentKey = timelineMoments.map((m) => m.splatUrl).join("|");

  useEffect(() => {
    let cancelled = false;

    async function resolve() {
      setViewerError(null);
      setDeskLayers(null);
      setMissingDeskIds([]);

      if (aholoSplatUrl) {
        setDeskReady(true);
        return;
      }

      const resolved = await Promise.all(
        timelineMoments.map((m) => resolveSplatUrl(m.splatUrl))
      );

      if (cancelled) return;

      const missing: string[] = [];
      const layers: TimelineSplatLayer[] = timelineMoments.map((m, i) => {
        if (resolved[i].missing) {
          missing.push(m.id);
          return {
            id: m.id,
            url: null,
            format: "ply" as AholoModelFormat,
            missing: true,
          };
        }
        return {
          id: m.id,
          url: resolved[i].url,
          format: splatFormatFromUrl(resolved[i].url),
          missing: false,
        };
      });

      const readyCount = layers.length - missing.length;
      if (readyCount === 0) {
        setDeskReady(false);
        setViewerError(
          `No splat files found in public/scenes/. ${DEMO_SPLAT_SETUP_HINT}`
        );
        return;
      }

      setDeskLayers(layers);
      setMissingDeskIds(missing);
      setDeskReady(true);
    }

    setDeskReady(null);
    resolve();
    return () => {
      cancelled = true;
    };
  }, [momentKey, aholoSplatUrl]);

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
        hint="Run: npm run bake-splats or npm run bake-splat:desk3"
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
        {missingDeskIds.length > 0 && (
          <p className="text-[10px] text-amber-200/80 leading-snug max-w-sm">
            Still waiting on: {missingDeskIds.join(", ")}.{" "}
            {missingDeskIds.includes("desk3") && (
              <>
                Desk3 bake may still be running — or run{" "}
                <code className="text-zinc-400">npm run bake-splat:desk3</code>
              </>
            )}
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
      ) : deskLayers ? (
        <TimelineSplatViewer
          key={deskLayers.map((l) => `${l.id}:${l.url ?? "x"}`).join("|")}
          layers={deskLayers}
          timelinePos={timelinePos}
          overlayAll={overlayBoth}
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
