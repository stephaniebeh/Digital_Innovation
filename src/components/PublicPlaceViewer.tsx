"use client";

import dynamic from "next/dynamic";
import { useMemo, useState } from "react";
import MemoryTimeline from "@/components/MemoryTimeline";
import {
  momentIndexAtPlaceTimeline,
  yearAtPlaceTimeline,
} from "@/lib/public-place-scenes";
import { blendForTimelinePosition } from "@/lib/demo-scenes";
import type { TimelineMoment } from "@/lib/demo-scenes";
import type { PublicPlace } from "@/lib/public-places";
import { defaultSplatAlignment } from "@/lib/scene-alignment";
import { DINING_HALL_TIMELINE_STATS } from "@/lib/timeline-stats";

const SceneViewer = dynamic(() => import("@/components/SceneViewer"), {
  ssr: false,
});

type Props = {
  place: PublicPlace;
  timelineMoments: TimelineMoment[];
  timelineYears: readonly number[];
  timelinePos: number;
  onTimelineChange: (t: number) => void;
  onBack: () => void;
};

export default function PublicPlaceViewer({
  place,
  timelineMoments,
  timelineYears,
  timelinePos,
  onTimelineChange,
  onBack,
}: Props) {
  const [hotspotOpen, setHotspotOpen] = useState(false);
  const blend = blendForTimelinePosition(timelinePos);
  const displayYear = yearAtPlaceTimeline(timelinePos, timelineYears);
  const activeMoment =
    timelineMoments[
      momentIndexAtPlaceTimeline(timelinePos, timelineMoments.length)
    ] ?? timelineMoments[0];

  const hint = useMemo(
    () => "Drag to orbit · scroll to zoom · scrub the timeline below",
    []
  );

  return (
    <main className="flex-1 flex flex-col relative min-h-0 h-[100dvh]">
      <div className="absolute inset-0 bottom-28">
        <SceneViewer
          timelineMoments={timelineMoments}
          timelinePos={blend}
          aholoSplatUrl={null}
          aholoModelFormat="ply"
          alignment={defaultSplatAlignment()}
          overlayBoth={false}
        />
      </div>

      <div className="absolute top-0 left-0 right-0 p-4 flex justify-between items-start pointer-events-none z-20">
        <div className="pointer-events-auto flex flex-col gap-2">
          <button
            type="button"
            onClick={onBack}
            className="text-xs px-3 py-2 rounded-lg border border-white/10 bg-black/40 text-zinc-400 hover:text-white backdrop-blur w-fit"
          >
            ← Campus map
          </button>
          <div>
            <p className="text-[10px] uppercase tracking-[0.3em] text-zinc-500">
              {place.name}
            </p>
            <p
              className="text-4xl font-light tabular-nums text-amber-50 transition-all duration-200"
              key={displayYear}
            >
              {displayYear}
            </p>
          </div>
        </div>
      </div>

      {hint && (
        <p className="absolute top-28 left-1/2 -translate-x-1/2 text-[11px] text-zinc-500 z-20 pointer-events-none text-center max-w-md px-4">
          {hint}
        </p>
      )}

      {activeMoment?.photos && activeMoment.photos.length > 0 && (
        <div className="absolute right-4 top-1/2 -translate-y-1/2 z-20 flex flex-col gap-2">
          <button
            type="button"
            onClick={() => setHotspotOpen((open) => !open)}
            className="px-3 py-2 rounded-full bg-black/50 border border-amber-200/30 text-xs text-amber-100/90 backdrop-blur hover:bg-black/70"
          >
            {hotspotOpen ? "Hide photos" : "Photos"}
          </button>
          {hotspotOpen && (
            <div className="flex flex-col gap-2 max-w-[140px]">
              {activeMoment.photos.map((photo) => (
                <figure
                  key={photo.src}
                  className="rounded-lg overflow-hidden border border-white/10 bg-black/60 backdrop-blur"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={photo.src}
                    alt={photo.caption ?? "Photograph"}
                    className="w-full aspect-[4/3] object-cover"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = "none";
                    }}
                  />
                  {photo.caption && (
                    <figcaption className="text-[10px] text-zinc-400 px-2 py-1">
                      {photo.caption}
                    </figcaption>
                  )}
                </figure>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="absolute bottom-0 left-0 right-0 z-30">
        <MemoryTimeline
          position={timelinePos}
          onChange={onTimelineChange}
          years={timelineYears}
          startLabel="Earlier"
          endLabel="Later"
          statsKeyframes={DINING_HALL_TIMELINE_STATS}
        />
      </div>
    </main>
  );
}
