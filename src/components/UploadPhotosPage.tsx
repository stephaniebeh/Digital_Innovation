"use client";

import type { InputHTMLAttributes } from "react";

type Props = {
  fileCount: number;
  minPhotos: number;
  hasEnough: boolean;
  error: string | null;
  onPickFiles: (list: FileList | null) => void;
  onStart: () => void;
  onBack: () => void;
};

export default function UploadPhotosPage({
  fileCount,
  minPhotos,
  hasEnough,
  error,
  onPickFiles,
  onStart,
  onBack,
}: Props) {
  const needed = Math.max(0, minPhotos - fileCount);

  return (
    <main className="flex-1 flex flex-col items-center justify-center px-6 py-16 max-w-lg mx-auto w-full gap-8">
      <header className="text-center space-y-3">
        <p className="text-[10px] uppercase tracking-[0.35em] text-amber-200/60">
          Contribute
        </p>
        <h1 className="text-3xl font-semibold tracking-tight">Add photos</h1>
        <p className="text-zinc-500 text-sm leading-relaxed max-w-sm mx-auto">
          Choose photos from a place you know. We&apos;ll turn them into a
          walkable memory you can revisit anytime.
        </p>
      </header>

      <section className="w-full space-y-4 rounded-2xl border border-white/10 bg-zinc-950/80 p-6">
        <div className="flex flex-col sm:flex-row gap-2">
          <label className="flex-1 cursor-pointer">
            <input
              type="file"
              multiple
              accept="image/*"
              onChange={(e) => {
                onPickFiles(e.target.files);
                e.target.value = "";
              }}
              className="w-full text-sm file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-white file:text-black file:font-medium cursor-pointer"
            />
          </label>
          <label className="shrink-0 cursor-pointer py-2 px-4 rounded-lg border border-white/15 text-xs text-zinc-300 hover:text-white hover:border-white/30 text-center">
            Select folder
            <input
              type="file"
              multiple
              className="sr-only"
              onChange={(e) => {
                onPickFiles(e.target.files);
                e.target.value = "";
              }}
              {...({ webkitdirectory: "", directory: "" } as InputHTMLAttributes<HTMLInputElement>)}
            />
          </label>
        </div>

        <p className="text-xs text-zinc-500">
          {fileCount > 0
            ? `${fileCount} photo${fileCount === 1 ? "" : "s"} selected${
                hasEnough
                  ? " — ready to begin"
                  : ` — ${needed} more needed`
              }`
            : `Select at least ${minPhotos} photos from different angles`}
        </p>

        {error && <p className="text-xs text-red-400/90">{error}</p>}

        <button
          type="button"
          onClick={onStart}
          disabled={!hasEnough}
          className="w-full py-3 rounded-xl bg-amber-100 text-black font-medium disabled:opacity-40 disabled:cursor-not-allowed hover:bg-white transition-colors"
        >
          {hasEnough ? "Create memory" : `Need ${needed} more photo${needed === 1 ? "" : "s"}`}
        </button>

        <p className="text-[11px] text-zinc-600 text-center">
          Processing may take a few minutes. Keep this tab open.
        </p>
      </section>

      <button
        type="button"
        onClick={onBack}
        className="text-xs text-zinc-500 hover:text-white"
      >
        ← Go back
      </button>
    </main>
  );
}
