"use client";

import type { PublicPlace } from "@/lib/public-places";

type Props = {
  place: PublicPlace;
  onBack: () => void;
};

export default function PublicPlacePlaceholder({ place, onBack }: Props) {
  return (
    <main className="flex-1 flex flex-col relative min-h-0 h-[100dvh] bg-black">
      <div className="absolute inset-0 overflow-hidden">
        {place.photos.map((photo, i) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={photo.src}
            src={photo.src}
            alt=""
            className="absolute inset-0 w-full h-full object-cover opacity-30 blur-sm scale-105"
            style={{
              transform: `scale(1.05) translateX(${i * 2}%)`,
            }}
          />
        ))}
        <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-black/70 to-black" />
      </div>

      <div className="relative z-10 flex flex-col flex-1 min-h-0">
        <div className="p-6 flex justify-between items-start">
          <button
            type="button"
            onClick={onBack}
            className="text-xs px-3 py-2 rounded-lg border border-white/15 bg-black/50 text-zinc-300 hover:text-white backdrop-blur"
          >
            ← Map
          </button>
        </div>

        <div className="flex-1 flex flex-col items-center justify-center px-6 text-center gap-8">
          <div className="space-y-3 max-w-md">
            <p className="text-[10px] uppercase tracking-[0.35em] text-amber-200/60">
              Immersive view
            </p>
            <h1 className="text-3xl md:text-4xl font-semibold text-amber-50">
              {place.name}
            </h1>
            <p className="text-zinc-400 text-sm leading-relaxed">
              {place.tagline}
            </p>
            <p className="text-zinc-500 text-xs leading-relaxed pt-2">
              A full walkthrough of this place is on the way. For now, browse
              photos shared by the community.
            </p>
          </div>

          <div className="flex gap-3 flex-wrap justify-center max-w-lg">
            {place.photos.map((photo) => (
              <figure
                key={photo.src}
                className="w-36 rounded-xl overflow-hidden border border-white/10 bg-black/50 backdrop-blur"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={photo.src}
                  alt={photo.caption ?? place.name}
                  className="w-full aspect-[4/3] object-cover"
                />
                {photo.caption && (
                  <figcaption className="text-[10px] text-zinc-400 px-2 py-1.5 text-left">
                    {photo.caption}
                  </figcaption>
                )}
              </figure>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}
