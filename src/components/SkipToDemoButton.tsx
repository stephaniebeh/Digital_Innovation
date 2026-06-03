"use client";

type Props = {
  onClick: () => void;
  label?: string;
};

export default function SkipToDemoButton({
  onClick,
  label = "Skip · view desk demo",
}: Props) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="fixed bottom-6 left-6 z-50 text-xs px-3 py-2.5 rounded-lg border border-white/15 bg-black/70 text-zinc-400 hover:text-white hover:border-white/30 backdrop-blur shadow-lg"
    >
      {label}
    </button>
  );
}
