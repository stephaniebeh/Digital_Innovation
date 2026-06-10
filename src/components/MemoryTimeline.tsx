"use client";

import { useCallback, useRef, useState } from "react";
import { TIMELINE_YEARS } from "@/lib/demo-scenes";
import {
  statsAtTimelinePosition,
  type TimelineHoverStats,
  type TimelineYearStats,
} from "@/lib/timeline-stats";

type Props = {
  position: number;
  onChange: (t: number) => void;
  years?: readonly number[];
  startLabel?: string;
  endLabel?: string;
  /** Per-year stats; interpolated while hovering along the track */
  statsKeyframes?: TimelineYearStats[];
};

function isArrowKey(key: string): boolean {
  return (
    key === "ArrowLeft" ||
    key === "ArrowRight" ||
    key === "ArrowUp" ||
    key === "ArrowDown"
  );
}

function TimelineHoverCard({ stats }: { stats: TimelineHoverStats }) {
  return (
    <div
      className="absolute bottom-full mb-2 -translate-x-1/2 z-30 w-44 rounded-lg border border-amber-200/25 bg-zinc-950/95 backdrop-blur-md shadow-lg px-3 py-2.5 pointer-events-none"
      role="tooltip"
    >
      <p className="text-sm font-medium tabular-nums text-amber-50">{stats.year}</p>
      <dl className="mt-2 space-y-1 text-[11px]">
        <div className="flex justify-between gap-3">
          <dt className="text-zinc-500">Contributors</dt>
          <dd className="text-zinc-200 tabular-nums">{stats.contributors}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-zinc-500">Images</dt>
          <dd className="text-zinc-200 tabular-nums">
            {stats.images.toLocaleString()}
          </dd>
        </div>
      </dl>
    </div>
  );
}

export default function MemoryTimeline({
  position,
  onChange,
  years = TIMELINE_YEARS,
  startLabel = "Earlier memory",
  endLabel = "Later memory",
  statsKeyframes,
}: Props) {
  const rangeRef = useRef<HTMLInputElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<{ t: number; x: number } | null>(null);
  const min = years[0] ?? 2020;
  const max = years[years.length - 1] ?? 2026;

  const hoverStats =
    hover && statsKeyframes?.length
      ? statsAtTimelinePosition(hover.t, years, statsKeyframes)
      : null;

  const updateHoverFromClientX = useCallback((clientX: number) => {
    const track = trackRef.current;
    if (!track) return;
    const rect = track.getBoundingClientRect();
    if (rect.width <= 0) return;
    const x = Math.max(0, Math.min(rect.width, clientX - rect.left));
    const t = x / rect.width;
    setHover({ t, x });
  }, []);

  return (
    <div className="w-full px-4 pb-6 pt-3 bg-gradient-to-t from-black via-black/90 to-transparent pointer-events-none">
      <div className="max-w-3xl mx-auto space-y-3 pointer-events-auto">
        <div className="flex justify-between text-[10px] uppercase tracking-[0.2em] text-zinc-500">
          <span>{startLabel}</span>
          <span>{endLabel}</span>
        </div>

        <div
          ref={trackRef}
          className="relative h-10 flex items-center"
          onPointerMove={(e) => updateHoverFromClientX(e.clientX)}
          onPointerLeave={() => setHover(null)}
        >
          <div className="absolute left-0 right-0 h-1 rounded-full bg-zinc-800" />
          <div
            className="absolute h-1 rounded-full bg-amber-200/80 transition-[width] duration-75"
            style={{ width: `${position * 100}%` }}
          />
          {years.map((year, i) => {
            const left =
              years.length <= 1 ? 50 : (i / (years.length - 1)) * 100;
            return (
              <button
                key={year}
                type="button"
                className="absolute -translate-x-1/2 w-2 h-2 rounded-full bg-zinc-600 hover:bg-amber-100 transition-colors z-[5]"
                style={{ left: `${left}%` }}
                onClick={() =>
                  onChange(years.length <= 1 ? 0 : i / (years.length - 1))
                }
                aria-label={`Jump to ${year}`}
              />
            );
          })}

          {hoverStats && (
            <div
              className="absolute top-0 bottom-0 z-20"
              style={{ left: hover!.x, width: 0 }}
            >
              <TimelineHoverCard stats={hoverStats} />
            </div>
          )}

          <input
            ref={rangeRef}
            type="range"
            min={0}
            max={1000}
            value={Math.round(position * 1000)}
            tabIndex={-1}
            onChange={(e) => onChange(Number(e.target.value) / 1000)}
            onPointerMove={(e) => updateHoverFromClientX(e.clientX)}
            onPointerLeave={() => setHover(null)}
            onKeyDown={(e) => {
              if (!isArrowKey(e.key)) return;
              e.preventDefault();
              rangeRef.current?.blur();
            }}
            onPointerUp={() => rangeRef.current?.blur()}
            className="absolute inset-0 w-full h-full opacity-0 cursor-ew-resize z-10"
            aria-label="Scrub through time"
            aria-valuemin={min}
            aria-valuemax={max}
          />
        </div>

        <div className="flex justify-between text-xs text-zinc-500 tabular-nums">
          {years.map((year) => (
            <span key={year}>{year}</span>
          ))}
        </div>
      </div>
    </div>
  );
}
