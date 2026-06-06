"use client";

import { useRef } from "react";
import { TIMELINE_YEARS } from "@/lib/demo-scenes";

type Props = {
  position: number;
  onChange: (t: number) => void;
  years?: readonly number[];
  startLabel?: string;
  endLabel?: string;
};

function isArrowKey(key: string): boolean {
  return (
    key === "ArrowLeft" ||
    key === "ArrowRight" ||
    key === "ArrowUp" ||
    key === "ArrowDown"
  );
}

export default function MemoryTimeline({
  position,
  onChange,
  years = TIMELINE_YEARS,
  startLabel = "Earlier memory",
  endLabel = "Later memory",
}: Props) {
  const rangeRef = useRef<HTMLInputElement>(null);
  const min = years[0] ?? 2020;
  const max = years[years.length - 1] ?? 2026;

  return (
    <div className="w-full px-4 pb-6 pt-3 bg-gradient-to-t from-black via-black/90 to-transparent pointer-events-none">
      <div className="max-w-3xl mx-auto space-y-3 pointer-events-auto">
        <div className="flex justify-between text-[10px] uppercase tracking-[0.2em] text-zinc-500">
          <span>{startLabel}</span>
          <span>{endLabel}</span>
        </div>

        <div className="relative h-10 flex items-center">
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
          <input
            ref={rangeRef}
            type="range"
            min={0}
            max={1000}
            value={Math.round(position * 1000)}
            tabIndex={-1}
            onChange={(e) => onChange(Number(e.target.value) / 1000)}
            onKeyDown={(e) => {
              if (!isArrowKey(e.key)) return;
              // Arrow keys rotate the 3D view; don't nudge this slider too.
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
