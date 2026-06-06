"use client";

type Props = {
  onClick: () => void;
  label?: string;
};

export default function PageBackButton({
  onClick,
  label = "Back",
}: Props) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="fixed top-6 left-6 z-50 text-xs px-3 py-2 rounded-lg border border-white/15 bg-black/60 text-zinc-300 hover:text-white hover:border-white/30 backdrop-blur"
    >
      ← {label}
    </button>
  );
}
