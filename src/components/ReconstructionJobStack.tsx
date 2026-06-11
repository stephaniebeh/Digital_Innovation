"use client";

import { RECONSTRUCTION_STAGES } from "@/lib/demo-scenes";
import {
  formatJobProgress,
  type ReconstructionJob,
} from "@/lib/reconstruction-jobs";

type Props = {
  jobs: ReconstructionJob[];
  onExpand: (id: string) => void;
  onCollapse: (id: string) => void;
  onView: (id: string) => void;
  onStorePublic: (id: string) => void;
  onStorePrivate: (id: string) => void;
  onCancelJob: (id: string) => void;
  onDismissFailed: (id: string) => void;
};

function ProgressRing({
  progress,
  ready,
  queued,
  error,
}: {
  progress: number;
  ready: boolean;
  queued: boolean;
  error: boolean;
}) {
  const pct = formatJobProgress(progress);
  const stroke = error
    ? "#f87171"
    : ready
      ? "#34d399"
      : queued
        ? "#71717a"
        : "#fde68a";

  return (
    <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90" aria-hidden>
      <circle
        cx="18"
        cy="18"
        r="15.5"
        fill="none"
        stroke="rgba(255,255,255,0.08)"
        strokeWidth="3"
      />
      <circle
        cx="18"
        cy="18"
        r="15.5"
        fill="none"
        stroke={stroke}
        strokeWidth="3"
        strokeLinecap="round"
        strokeDasharray={`${ready ? 100 : queued ? 8 : pct} 100`}
        pathLength={100}
        className={ready || error ? "" : "transition-all duration-300"}
      />
    </svg>
  );
}

function JobChip({
  job,
  onExpand,
}: {
  job: ReconstructionJob;
  onExpand: () => void;
}) {
  const ready = job.status === "ready";
  const queued = job.status === "queued";
  const failed = job.status === "failed";
  const active = job.status === "uploading" || job.status === "processing";
  const pct = formatJobProgress(job.progress);

  return (
    <button
      type="button"
      onClick={onExpand}
      className={`relative w-14 h-14 rounded-full border bg-zinc-950/95 backdrop-blur-md shadow-lg flex items-center justify-center transition-transform hover:scale-105 active:scale-95 ${
        ready
          ? "border-emerald-200/40"
          : failed
            ? "border-red-400/35"
            : queued
              ? "border-zinc-600/50"
              : "border-amber-200/25"
      }`}
      aria-label={`${job.label} — ${job.status}`}
      title={job.label}
    >
      <div className="absolute inset-1.5">
        <ProgressRing
          progress={job.progress}
          ready={ready}
          queued={queued}
          error={failed}
        />
      </div>
      <span className="relative z-10 text-[10px] font-medium tabular-nums text-amber-50">
        {ready ? (
          <span className="text-emerald-300 text-sm">✓</span>
        ) : failed ? (
          <span className="text-red-300 text-sm">!</span>
        ) : queued ? (
          <span className="text-zinc-400 text-[9px]">···</span>
        ) : (
          `${pct}%`
        )}
      </span>
      {active && (
        <span className="absolute inset-0 rounded-full border-2 border-amber-200/20 border-t-amber-200/70 animate-spin pointer-events-none" />
      )}
    </button>
  );
}

function ExpandedCard({
  job,
  onCollapse,
  onView,
  onStorePublic,
  onStorePrivate,
  onCancelJob,
  onDismissFailed,
}: {
  job: ReconstructionJob;
  onCollapse: () => void;
  onView: () => void;
  onStorePublic: () => void;
  onStorePrivate: () => void;
  onCancelJob: () => void;
  onDismissFailed: () => void;
}) {
  const stage =
    RECONSTRUCTION_STAGES[job.stageIndex] ?? RECONSTRUCTION_STAGES.at(-1);

  if (job.status === "ready") {
    return (
      <div className="w-[min(100vw-5rem,22rem)] rounded-xl border border-emerald-200/35 bg-zinc-950/95 backdrop-blur-md shadow-xl pointer-events-auto">
        <div className="p-4 space-y-3">
          <Header
            title="Memory ready"
            subtitle={`${job.label} — choose where to keep it`}
            onCollapse={onCollapse}
          />
          <div className="flex flex-col gap-2">
            <button
              type="button"
              onClick={onView}
              className="w-full py-2 rounded-lg bg-emerald-500 text-black text-xs font-medium hover:bg-emerald-400"
            >
              View now
            </button>
            <button
              type="button"
              onClick={onStorePublic}
              className="w-full py-2 rounded-lg border border-amber-200/30 text-amber-100 text-xs hover:bg-amber-950/40"
            >
              Add to campus map
            </button>
            <button
              type="button"
              onClick={onStorePrivate}
              className="w-full py-2 rounded-lg border border-white/15 text-zinc-300 text-xs hover:bg-white/5"
            >
              Add to my spaces
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (job.status === "failed") {
    return (
      <div className="w-[min(100vw-5rem,22rem)] rounded-xl border border-red-400/25 bg-zinc-950/95 backdrop-blur-md shadow-xl pointer-events-auto">
        <div className="p-4 space-y-3">
          <Header title="Build failed" subtitle={job.label} onCollapse={onCollapse} />
          <p className="text-sm text-red-300/90 leading-snug">{job.error}</p>
          <button
            type="button"
            onClick={onDismissFailed}
            className="w-full py-2 rounded-lg border border-white/10 text-zinc-400 text-xs hover:text-white"
          >
            Dismiss
          </button>
        </div>
      </div>
    );
  }

  const queued = job.status === "queued";

  return (
    <div className="w-[min(100vw-5rem,22rem)] rounded-xl border border-amber-200/20 bg-zinc-950/95 backdrop-blur-md shadow-xl pointer-events-auto">
      <div className="p-4 space-y-3">
        <Header
          title={queued ? "Waiting in line" : "Building in background"}
          subtitle={job.label}
          onCollapse={onCollapse}
        />
        <p className="text-sm text-amber-50/90 truncate">
          {queued ? "Queued — another scan is running first" : stage}
        </p>
        {job.statusLine && (
          <p className="text-[11px] text-zinc-500 truncate">{job.statusLine}</p>
        )}
        {!queued && (
          <div className="h-1 rounded-full bg-zinc-800 overflow-hidden">
            <div
              className="h-full bg-amber-200/60 transition-all duration-300"
              style={{ width: `${formatJobProgress(job.progress)}%` }}
            />
          </div>
        )}
        {!queued && (
          <button
            type="button"
            onClick={onCancelJob}
            className="w-full py-1.5 rounded-lg border border-white/10 text-zinc-500 text-xs hover:text-red-300 hover:border-red-400/25"
          >
            Cancel job
          </button>
        )}
        {queued && (
          <button
            type="button"
            onClick={onCancelJob}
            className="w-full py-1.5 rounded-lg border border-white/10 text-zinc-500 text-xs hover:text-red-300 hover:border-red-400/25"
          >
            Remove from queue
          </button>
        )}
      </div>
    </div>
  );
}

function Header({
  title,
  subtitle,
  onCollapse,
}: {
  title: string;
  subtitle: string;
  onCollapse: () => void;
}) {
  return (
    <div className="flex items-start justify-between gap-2">
      <div className="min-w-0">
        <p className="text-sm font-medium text-amber-50">{title}</p>
        <p className="text-[11px] text-zinc-500 mt-0.5 truncate">{subtitle}</p>
      </div>
      <button
        type="button"
        onClick={onCollapse}
        className="shrink-0 text-zinc-500 hover:text-white text-sm leading-none px-1"
        aria-label="Minimize"
      >
        ×
      </button>
    </div>
  );
}

export default function ReconstructionJobStack({
  jobs,
  onExpand,
  onCollapse,
  onView,
  onStorePublic,
  onStorePrivate,
  onCancelJob,
  onDismissFailed,
}: Props) {
  if (jobs.length === 0) return null;

  const expandedJob = jobs.find((j) => j.expanded);

  return (
    <div className="fixed bottom-6 left-6 z-[1200] flex items-end gap-3 pointer-events-none">
      <div className="flex flex-col-reverse gap-2 pointer-events-auto">
        {jobs.map((job) => (
          <div key={job.id} className="relative">
            <JobChip job={job} onExpand={() => onExpand(job.id)} />
          </div>
        ))}
      </div>
      {expandedJob && (
        <ExpandedCard
          job={expandedJob}
          onCollapse={() => onCollapse(expandedJob.id)}
          onView={() => onView(expandedJob.id)}
          onStorePublic={() => onStorePublic(expandedJob.id)}
          onStorePrivate={() => onStorePrivate(expandedJob.id)}
          onCancelJob={() => onCancelJob(expandedJob.id)}
          onDismissFailed={() => onDismissFailed(expandedJob.id)}
        />
      )}
    </div>
  );
}