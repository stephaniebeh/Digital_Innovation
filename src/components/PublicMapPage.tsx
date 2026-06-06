"use client";

import dynamic from "next/dynamic";
import { useMemo, useState } from "react";
import MemoryTimeline from "@/components/MemoryTimeline";
import {
  PUBLIC_MAP_TITLE,
  PUBLIC_MAP_YEARS,
  PUBLIC_PLACES,
  heatForPlace,
  yearAtPublicTimeline,
  type PublicPlace,
} from "@/lib/public-places";

const CampusMapLeaflet = dynamic(() => import("@/components/CampusMapLeaflet"), {
  ssr: false,
  loading: () => (
    <div className="absolute inset-0 flex items-center justify-center bg-zinc-950 text-sm text-zinc-500">
      Loading campus map…
    </div>
  ),
});

type Props = {
  timelinePos: number;
  onTimelineChange: (t: number) => void;
  onSelectPlace: (place: PublicPlace) => void;
  onBack: () => void;
};

export default function PublicMapPage({
  timelinePos,
  onTimelineChange,
  onSelectPlace,
  onBack,
}: Props) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const displayYear = yearAtPublicTimeline(timelinePos);

  const heats = useMemo(
    () =>
      PUBLIC_PLACES.map((place) => ({
        place,
        heat: heatForPlace(place, timelinePos),
      })),
    [timelinePos]
  );

  return (
    <main className="flex-1 flex flex-col relative min-h-0 h-[100dvh] bg-black">
      <div className="absolute top-0 left-0 right-0 p-6 flex justify-between items-start z-[600] pointer-events-none">
        <div className="pointer-events-auto">
          <button
            type="button"
            onClick={onBack}
            className="text-xs px-3 py-2 rounded-lg border border-white/15 bg-black/50 text-zinc-300 hover:text-white backdrop-blur"
          >
            ← Home
          </button>
        </div>
        <div className="text-right pointer-events-none">
          <p className="text-[10px] uppercase tracking-[0.3em] text-zinc-500">
            {PUBLIC_MAP_TITLE}
          </p>
          <p className="text-3xl font-light tabular-nums text-amber-50">
            {displayYear}
          </p>
        </div>
      </div>

      <div className="flex-1 relative min-h-0 pb-28">
        <CampusMapLeaflet
          heats={heats}
          timelinePos={timelinePos}
          hoveredId={hoveredId}
          onHover={setHoveredId}
          onSelectPlace={onSelectPlace}
        />

        <p className="absolute bottom-32 left-1/2 -translate-x-1/2 text-[11px] text-zinc-500 z-[600] pointer-events-none text-center px-4 max-w-sm">
          Pan and zoom the map · scrub the timeline to see activity shift ·
          hover markers to explore
        </p>
      </div>

      <div className="absolute bottom-0 left-0 right-0 z-[700] pointer-events-none">
        <MemoryTimeline
          position={timelinePos}
          onChange={onTimelineChange}
          years={PUBLIC_MAP_YEARS}
          startLabel="Earlier"
          endLabel="Later"
        />
      </div>
    </main>
  );
}
