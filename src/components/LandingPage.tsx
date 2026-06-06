"use client";

type Props = {
  onPublic: () => void;
  onPrivate: () => void;
};

export default function LandingPage({ onPublic, onPrivate }: Props) {
  return (
    <main className="flex-1 flex flex-col items-center justify-center px-6 py-16 max-w-2xl mx-auto w-full text-center gap-12">
      <header className="space-y-5">
        <h1 className="text-5xl md:text-6xl font-semibold tracking-tight text-amber-50">
          Afterimage
        </h1>
        <p className="text-zinc-400 text-base md:text-lg leading-relaxed max-w-md mx-auto">
          See how places change through shared memory — explore the city, or
          preserve your own.
        </p>
      </header>

      <div className="w-full grid sm:grid-cols-2 gap-4 max-w-lg">
        <button
          type="button"
          onClick={onPublic}
          className="group rounded-2xl border border-white/10 bg-zinc-950/80 p-8 text-left hover:border-amber-200/30 hover:bg-zinc-900/80 transition-all"
        >
          <p className="text-[10px] uppercase tracking-[0.3em] text-amber-200/60 mb-3">
            Explore
          </p>
          <h2 className="text-xl font-medium text-white mb-2">Public</h2>
          <p className="text-sm text-zinc-500 leading-relaxed">
            Walk the city map, follow popular spots through time, and step
            inside places others have captured.
          </p>
          <span className="inline-block mt-6 text-xs text-amber-100/80 group-hover:text-amber-50">
            Open map →
          </span>
        </button>

        <button
          type="button"
          onClick={onPrivate}
          className="group rounded-2xl border border-white/10 bg-zinc-950/80 p-8 text-left hover:border-amber-200/30 hover:bg-zinc-900/80 transition-all"
        >
          <p className="text-[10px] uppercase tracking-[0.3em] text-amber-200/60 mb-3">
            Personal
          </p>
          <h2 className="text-xl font-medium text-white mb-2">Private</h2>
          <p className="text-sm text-zinc-500 leading-relaxed">
            Revisit your own spaces, add new rooms, and watch them evolve over
            the years.
          </p>
          <span className="inline-block mt-6 text-xs text-amber-100/80 group-hover:text-amber-50">
            Enter →
          </span>
        </button>
      </div>
    </main>
  );
}
