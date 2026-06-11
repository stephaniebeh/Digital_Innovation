"use client";

import { RECONSTRUCTION_STAGES } from "@/lib/demo-scenes";
import { formatJobProgress } from "@/lib/reconstruction-jobs";

type Props = {
  stageIndex: number;
  progress: number;
  statusLine?: string | null;
  error?: string | null;
  onContinueBrowsing?: () => void;
};

export default function ReconstructionLoader({
  stageIndex,
  progress,
  statusLine,
  error,
  onContinueBrowsing,
}: Props) {
  const stage =
    RECONSTRUCTION_STAGES[stageIndex] ?? RECONSTRUCTION_STAGES.at(-1);

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-8 px-6 text-center">
      <div className="relative w-24 h-24">
        <div className="absolute inset-0 rounded-full border border-amber-200/20" />
        <div
          className="absolute inset-0 rounded-full border-2 border-amber-200/70 border-t-transparent animate-spin"
          style={{ animationDuration: "2.4s" }}
        />
        <div className="absolute inset-3 rounded-full bg-amber-200/5 blur-md" />
      </div>

      <div className="space-y-2 max-w-md">
        <p className="text-xs uppercase tracking-[0.25em] text-zinc-500">
          Reconstructing memory
        </p>
        <p className="text-xl font-light text-amber-50/90 transition-all duration-500">
          {stage}
        </p>
        {statusLine && (
          <p className="text-xs text-zinc-500">{statusLine}</p>
        )}
        {error && (
          <p className="text-sm text-red-400/90 max-w-md leading-snug">{error}</p>
        )}
        <div className="h-1 w-48 mx-auto rounded-full bg-zinc-800 overflow-hidden">
          <div
            className="h-full bg-amber-200/60 transition-all duration-300"
            style={{ width: `${formatJobProgress(progress)}%` }}
          />
        </div>
      </div>

      <ul className="text-xs text-zinc-600 space-y-1">
        {RECONSTRUCTION_STAGES.map((label, i) => (
          <li
            key={label}
            className={
              i <= stageIndex ? "text-zinc-400" : "text-zinc-700"
            }
          >
            {i < stageIndex ? "✓ " : i === stageIndex ? "→ " : "  "}
            {label}
          </li>
        ))}
      </ul>

      {onContinueBrowsing && !error && (
        <button
          type="button"
          onClick={onContinueBrowsing}
          className="mt-2 text-xs px-4 py-2.5 rounded-lg border border-white/15 bg-black/40 text-zinc-300 hover:text-white hover:border-white/25 backdrop-blur transition-colors"
        >
          Continue browsing while this runs
        </button>
      )}
    </div>
  );
}
