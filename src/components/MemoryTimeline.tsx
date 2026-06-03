"use client";

import { TIMELINE_YEARS } from "@/lib/demo-scenes";

type Props = {
  position: number;
  onChange: (t: number) => void;
};

export default function MemoryTimeline({ position, onChange }: Props) {
  const min = TIMELINE_YEARS[0] ?? 2020;
  const max = TIMELINE_YEARS[TIMELINE_YEARS.length - 1] ?? 2026;

  return (
    <div className="w-full px-4 pb-6 pt-3 bg-gradient-to-t from-black via-black/90 to-transparent">
      <div className="max-w-3xl mx-auto space-y-3">
        <div className="flex justify-between text-[10px] uppercase tracking-[0.2em] text-zinc-500">
          <span>Earlier memory</span>
          <span>Later memory</span>
        </div>

        <div className="relative h-10 flex items-center">
          <div className="absolute left-0 right-0 h-1 rounded-full bg-zinc-800" />
          <div
            className="absolute h-1 rounded-full bg-amber-200/80 transition-[width] duration-75"
            style={{ width: `${position * 100}%` }}
          />
          {TIMELINE_YEARS.map((year, i) => {
            const left =
              TIMELINE_YEARS.length <= 1
                ? 50
                : (i / (TIMELINE_YEARS.length - 1)) * 100;
            return (
              <button
                key={year}
                type="button"
                className="absolute -translate-x-1/2 w-2 h-2 rounded-full bg-zinc-600 hover:bg-amber-100 transition-colors z-[5]"
                style={{ left: `${left}%` }}
                onClick={() =>
                  onChange(
                    TIMELINE_YEARS.length <= 1
                      ? 0
                      : i / (TIMELINE_YEARS.length - 1)
                  )
                }
                aria-label={`Jump to ${year}`}
              />
            );
          })}
          <input
            type="range"
            min={0}
            max={1000}
            value={Math.round(position * 1000)}
            onChange={(e) => onChange(Number(e.target.value) / 1000)}
            className="absolute inset-0 w-full h-full opacity-0 cursor-ew-resize z-10"
            aria-label="Scrub through time"
            aria-valuemin={min}
            aria-valuemax={max}
          />
        </div>

        <div className="flex justify-between text-xs text-zinc-500 font-mono">
          {TIMELINE_YEARS.map((year) => (
            <span key={year}>{year}</span>
          ))}
        </div>
      </div>
    </div>
  );
}
