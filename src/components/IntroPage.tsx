"use client";

type Props = {
  onStart: () => void;
};

const IDEAS = [
  {
    title: "Traces",
    body: "Every photograph marks what someone noticed. Those choices are the raw material of a place's memory.",
  },
  {
    title: "Collective",
    body: "No two people see a space the same way. Layer many views and patterns of shared attention emerge.",
  },
  {
    title: "Time",
    body: "Buildings change, crowds shift, moments pass. Move through a place's history instead of a single snapshot.",
  },
] as const;

const PIPELINE = [
  {
    step: "1",
    title: "Collect traces",
    detail:
      "Users upload 20+ overlapping photos per scene. Each image is treated as a trace of attention, not just texture input.",
  },
  {
    step: "2",
    title: "Ingest and reconstruct",
    detail:
      "Our Next.js API uploads images to Aholo OUS, then calls the Aholo World API to start a 3D Gaussian Splatting reconstruction job (space mode).",
  },
  {
    step: "3",
    title: "Poll and package",
    detail:
      "The client polls our /api/world proxy, which checks Aholo API job status (PENDING, RUNNING, SUCCEEDED) until a PLY or SPZ splat is ready.",
  },
  {
    step: "4",
    title: "View and compare",
    detail:
      "Splats are proxied through /api/model for CORS-safe loading, rendered in the browser, and placed on a timeline or map for temporal comparison.",
  },
] as const;

const LAYERS = [
  {
    label: "Experience",
    items: [
      "React client (upload, map, viewers, editor)",
      "Background reconstruction job queue",
      "Memory timeline scrubbing",
    ],
  },
  {
    label: "Application API",
    items: [
      "POST /api/reconstruct",
      "GET /api/world/[worldId]",
      "GET /api/model (splat proxy)",
      "GET /api/scenes/alignment",
    ],
  },
  {
    label: "Reconstruction",
    items: [
      "Aholo OUS object upload",
      "Aholo World API (PENDING / RUNNING / SUCCEEDED)",
      "3DGS output: PLY / SPZ gaussian splats",
    ],
  },
  {
    label: "Rendering",
    items: [
      "gaussian-splats-3d + Three.js",
      "Leaflet campus map and heat layers",
      "Optional multi-scene alignment editor",
    ],
  },
] as const;

export default function IntroPage({ onStart }: Props) {
  return (
    <main className="relative flex-1 overflow-x-hidden">
      <div className="pointer-events-none fixed inset-0" aria-hidden>
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 h-96 w-96 rounded-full bg-amber-500/8 blur-[120px]" />
        <div
          className="absolute inset-0 opacity-25"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.025) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.025) 1px, transparent 1px)",
            backgroundSize: "72px 72px",
            maskImage:
              "radial-gradient(ellipse 65% 55% at 50% 30%, black 15%, transparent 70%)",
          }}
        />
      </div>

      <section className="relative z-10 min-h-[100dvh] flex flex-col items-center justify-center px-6 py-20">
        <div className="w-full max-w-3xl mx-auto text-center">
          <h1 className="text-5xl md:text-6xl font-semibold tracking-tight text-amber-50 mb-4">
            Afterimage
          </h1>

          <p className="text-sm text-zinc-500 leading-relaxed max-w-md mx-auto mb-14">
            Rebuild spaces from photographic traces and explore the collective
            attention within them.
          </p>

          <div className="grid sm:grid-cols-3 gap-4 text-left mb-14">
            {IDEAS.map((idea) => (
              <div
                key={idea.title}
                className="rounded-2xl border border-white/[0.07] bg-zinc-950/40 p-5"
              >
                <h2 className="text-sm font-medium text-amber-100/90 mb-2">
                  {idea.title}
                </h2>
                <p className="text-sm text-zinc-500 leading-relaxed">
                  {idea.body}
                </p>
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={onStart}
            className="px-10 py-3.5 rounded-full bg-amber-200 text-black text-sm font-medium hover:bg-amber-100 transition-colors"
          >
            Start
          </button>

          <span
            className="mt-10 inline-block text-zinc-600/50 text-lg leading-none"
            aria-hidden
          >
            ↓
          </span>
        </div>
      </section>

      <section className="relative z-10 border-t border-white/[0.06] bg-zinc-950/30 px-6 py-20 md:py-24">
        <div className="w-full max-w-4xl mx-auto">
          <header className="text-center mb-14">
            <p className="text-[10px] uppercase tracking-[0.4em] text-amber-200/45 mb-3">
              Technical overview
            </p>
            <h2 className="text-2xl md:text-3xl font-medium text-amber-50 mb-3">
              How the system works
            </h2>
            <p className="text-sm text-zinc-500 max-w-2xl mx-auto leading-relaxed">
              A prototype pipeline that turns collective photographic traces
              into explorable spatial memories, built on Aholo reconstruction
              and in-browser gaussian splat viewing.
            </p>
          </header>

          <div className="mb-16">
            <h3 className="text-xs uppercase tracking-[0.3em] text-zinc-500 mb-6">
              End-to-end flow
            </h3>
            <ol className="space-y-4">
              {PIPELINE.map((item, index) => (
                <li
                  key={item.step}
                  className="relative flex gap-5 rounded-2xl border border-white/[0.07] bg-black/40 p-5 md:p-6"
                >
                  <div className="shrink-0 flex flex-col items-center">
                    <span className="flex h-8 w-8 items-center justify-center rounded-full border border-amber-200/25 bg-amber-200/10 text-xs font-medium text-amber-100">
                      {item.step}
                    </span>
                    {index < PIPELINE.length - 1 && (
                      <span className="mt-2 h-full w-px bg-white/10 hidden sm:block" />
                    )}
                  </div>
                  <div className="min-w-0 pt-0.5">
                    <h4 className="text-sm font-medium text-white mb-1.5">
                      {item.title}
                    </h4>
                    <p className="text-sm text-zinc-500 leading-relaxed">
                      {item.detail}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          </div>

          <div className="mb-14">
            <h3 className="text-xs uppercase tracking-[0.3em] text-zinc-500 mb-6">
              Architecture layers
            </h3>
            <div className="grid sm:grid-cols-2 gap-4">
              {LAYERS.map((layer) => (
                <div
                  key={layer.label}
                  className="rounded-2xl border border-white/[0.07] bg-zinc-950/50 p-5"
                >
                  <h4 className="text-sm font-medium text-amber-100/90 mb-3">
                    {layer.label}
                  </h4>
                  <ul className="space-y-2">
                    {layer.items.map((item) => (
                      <li
                        key={item}
                        className="text-sm text-zinc-500 leading-snug flex gap-2"
                      >
                        <span className="text-amber-200/40 shrink-0">·</span>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-white/[0.07] bg-zinc-950/40 p-6 text-center">
            <p className="text-xs uppercase tracking-[0.3em] text-zinc-600 mb-4">
              Stack
            </p>
            <p className="text-sm text-zinc-400 leading-relaxed">
              Next.js 16 · React 19 · Aholo World API · 3D Gaussian Splatting
              (PLY/SPZ) · gaussian-splats-3d · Three.js · Leaflet
            </p>
            <button
              type="button"
              onClick={onStart}
              className="mt-8 px-8 py-3 rounded-full border border-amber-200/25 text-amber-100 text-sm hover:bg-amber-200/10 transition-colors"
            >
              Enter prototype
            </button>
          </div>
        </div>
      </section>
    </main>
  );
}