"use client";

type Props = {
  title: string;
  message: string;
  hint?: string;
};

export default function ViewerErrorPanel({ title, message, hint }: Props) {
  return (
    <div className="absolute inset-0 bg-zinc-950 flex items-center justify-center p-6 z-10">
      <div className="max-w-md text-center space-y-3">
        <p className="text-sm uppercase tracking-wider text-amber-200/70">
          {title}
        </p>
        <p className="text-zinc-300 text-sm leading-relaxed">{message}</p>
        {hint && (
          <p className="text-xs text-zinc-500 font-mono leading-relaxed">{hint}</p>
        )}
      </div>
    </div>
  );
}
