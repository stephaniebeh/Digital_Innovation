"use client";

type Props = {
  onClick: () => void;
  label?: string;
};

export default function FloatingAddButton({
  onClick,
  label = "Add photos",
}: Props) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className="fixed bottom-6 right-6 z-[1100] w-14 h-14 rounded-full bg-amber-100 text-black shadow-lg shadow-amber-900/30 flex items-center justify-center text-2xl font-light hover:bg-white hover:scale-105 active:scale-95 transition-all pointer-events-auto"
    >
      +
    </button>
  );
}
