"use client";

type Props = {
  onMyRoom: () => void;
  onAddSpace: () => void;
  onBack: () => void;
};

export default function PrivateHubPage({
  onMyRoom,
  onAddSpace,
  onBack,
}: Props) {
  return (
    <main className="flex-1 flex flex-col items-center justify-center px-6 py-16 max-w-lg mx-auto w-full text-center gap-10">
      <header className="space-y-3">
        <p className="text-[10px] uppercase tracking-[0.35em] text-amber-200/60">
          Private
        </p>
        <h1 className="text-3xl font-semibold tracking-tight">Your spaces</h1>
        <p className="text-zinc-500 text-sm">
          Open a saved room or start capturing a new one.
        </p>
      </header>

      <div className="w-full space-y-3">
        <button
          type="button"
          onClick={onMyRoom}
          className="w-full rounded-2xl border border-white/10 bg-zinc-950/80 p-6 text-left hover:border-amber-200/30 hover:bg-zinc-900/80 transition-all"
        >
          <h2 className="text-lg font-medium text-white mb-1">My Room</h2>
          <p className="text-sm text-zinc-500">
            Step inside your room and watch how it changed across the years.
          </p>
        </button>

        <button
          type="button"
          onClick={onAddSpace}
          className="w-full rounded-2xl border border-dashed border-white/15 bg-zinc-950/40 p-6 text-left hover:border-amber-200/30 hover:bg-zinc-900/60 transition-all"
        >
          <h2 className="text-lg font-medium text-white mb-1">Add Space</h2>
          <p className="text-sm text-zinc-500">
            Upload photos of a room or corner you want to remember.
          </p>
        </button>
      </div>

      <button
        type="button"
        onClick={onBack}
        className="text-xs text-zinc-500 hover:text-white"
      >
        ← Back to home
      </button>
    </main>
  );
}
