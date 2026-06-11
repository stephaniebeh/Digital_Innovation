"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  openExistingWorld,
  startReconstruction,
} from "@/lib/aholo/client";
import {
  advanceProgress,
  createJobId,
  estimateAholoProgress,
  friendlyReconStatus,
  isActiveJobStatus,
  jobLabel,
  progressFromUploadRatio,
  PROGRESS_BANDS,
  stageIndexForStatus,
  type ReconstructionJob,
} from "@/lib/reconstruction-jobs";

type PendingWork = {
  id: string;
  images: File[];
  uploadOrigin: "public" | "private";
};

type EnqueueResult = {
  jobId: string;
  startsNow: boolean;
};

function patchJob(
  jobs: ReconstructionJob[],
  id: string,
  patch: Partial<ReconstructionJob>
): ReconstructionJob[] {
  const defined = Object.fromEntries(
    Object.entries(patch).filter(([, value]) => value !== undefined)
  ) as Partial<ReconstructionJob>;

  return jobs.map((j) => (j.id === id ? { ...j, ...defined } : j));
}

export function useReconstructionQueue() {
  const [jobs, setJobs] = useState<ReconstructionJob[]>([]);
  const [foregroundJobId, setForegroundJobId] = useState<string | null>(null);
  const pendingRef = useRef<PendingWork[]>([]);
  const cancelledRef = useRef<Set<string>>(new Set());
  const workerRunningRef = useRef(false);
  const progressTargetRef = useRef<Map<string, number>>(new Map());
  const processingStartedRef = useRef<Map<string, number>>(new Map());

  const bumpProgress = useCallback((id: string, next: number) => {
    progressTargetRef.current.set(id, next);
    setJobs((prev) =>
      prev.map((j) =>
        j.id === id
          ? { ...j, progress: advanceProgress(j.progress, next) }
          : j
      )
    );
  }, []);

  const clearProgressTracking = useCallback((id: string) => {
    progressTargetRef.current.delete(id);
    processingStartedRef.current.delete(id);
  }, []);

  const updateJob = useCallback((id: string, patch: Partial<ReconstructionJob>) => {
    setJobs((prev) => patchJob(prev, id, patch));
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setJobs((prev) =>
        prev.map((j) => {
          if (j.status !== "uploading" && j.status !== "processing") return j;
          const target = progressTargetRef.current.get(j.id);
          if (target === undefined || j.progress >= target - 0.003) return j;
          return {
            ...j,
            progress: advanceProgress(j.progress, j.progress + 0.004),
          };
        })
      );
    }, 600);
    return () => window.clearInterval(timer);
  }, []);

  const runJob = useCallback(
    async (work: PendingWork) => {
      const { id, images, uploadOrigin } = work;

      if (cancelledRef.current.has(id)) {
        setJobs((prev) => prev.filter((j) => j.id !== id));
        clearProgressTracking(id);
        return;
      }

      setJobs((prev) => {
        const exists = prev.some((j) => j.id === id);
        const base: ReconstructionJob = {
          id,
          imageCount: images.length,
          label: jobLabel(images.length),
          status: "uploading",
          stageIndex: 0,
          progress: PROGRESS_BANDS.uploadMin,
          statusLine: "Uploading your photos.",
          error: null,
          splatUrl: null,
          modelFormat: "ply",
          collapsed: true,
          expanded: false,
          uploadOrigin,
          createdAt: Date.now(),
        };
        return exists ? patchJob(prev, id, base) : [...prev, base];
      });

      progressTargetRef.current.set(id, PROGRESS_BANDS.uploadMin);

      try {
        updateJob(id, {
          status: "uploading",
          statusLine: "Uploading your photos.",
          stageIndex: 1,
          error: null,
        });

        const { worldId, imageCount } = await startReconstruction(images, {
          name: "Afterimage capture",
          scene: "space",
          taskQuality: "high",
          onUploadProgress: (ratio) => {
            bumpProgress(id, progressFromUploadRatio(ratio));
          },
        });

        if (cancelledRef.current.has(id)) {
          setJobs((prev) => prev.filter((j) => j.id !== id));
          clearProgressTracking(id);
          return;
        }

        bumpProgress(id, PROGRESS_BANDS.processingMin);
        processingStartedRef.current.set(id, Date.now());

        updateJob(id, {
          status: "processing",
          statusLine: `${imageCount} photos received`,
          stageIndex: 2,
        });

        const { proxiedUrl, format } = await openExistingWorld(worldId, {
          shouldAbort: () => cancelledRef.current.has(id),
          onStatus: (snapshot) => {
            const processingStartedAt =
              processingStartedRef.current.get(id) ?? Date.now();
            const estimated = estimateAholoProgress(
              snapshot,
              imageCount,
              processingStartedAt
            );
            bumpProgress(id, estimated);
            updateJob(id, {
              statusLine: friendlyReconStatus(snapshot.status),
              stageIndex: stageIndexForStatus(snapshot.status, false),
            });
          },
        });

        if (cancelledRef.current.has(id)) {
          setJobs((prev) => prev.filter((j) => j.id !== id));
          clearProgressTracking(id);
          return;
        }

        bumpProgress(id, PROGRESS_BANDS.done);
        updateJob(id, {
          status: "ready",
          splatUrl: proxiedUrl,
          modelFormat: format,
          stageIndex: 3,
          statusLine: "Ready to view",
          collapsed: true,
          expanded: false,
        });
        clearProgressTracking(id);
      } catch (err) {
        if (cancelledRef.current.has(id)) {
          setJobs((prev) => prev.filter((j) => j.id !== id));
          clearProgressTracking(id);
          return;
        }
        const message =
          err instanceof Error ? err.message : "Something went wrong";
        updateJob(id, {
          status: "failed",
          error:
            message.includes("AHOLO") || message.includes("API")
              ? "We couldn't process your photos right now. Please try again later."
              : message,
          progress: 0,
          collapsed: true,
          expanded: false,
        });
        clearProgressTracking(id);
      }
    },
    [bumpProgress, clearProgressTracking, updateJob]
  );

  const pumpWorker = useCallback(async () => {
    if (workerRunningRef.current) return;
    workerRunningRef.current = true;

    try {
      while (pendingRef.current.length > 0) {
        const work = pendingRef.current.shift();
        if (!work || cancelledRef.current.has(work.id)) continue;
        await runJob(work);
      }
    } finally {
      workerRunningRef.current = false;
      if (pendingRef.current.length > 0) {
        void pumpWorker();
      }
    }
  }, [runJob]);

  const enqueue = useCallback(
    (images: File[], uploadOrigin: "public" | "private"): EnqueueResult => {
      const id = createJobId();
      const startsNow =
        pendingRef.current.length === 0 && !workerRunningRef.current;

      const queuedJob: ReconstructionJob = {
        id,
        imageCount: images.length,
        label: jobLabel(images.length),
        status: startsNow ? "uploading" : "queued",
        stageIndex: 0,
        progress: startsNow ? PROGRESS_BANDS.uploadMin : 0,
        statusLine: startsNow ? "Starting." : "Waiting in line.",
        error: null,
        splatUrl: null,
        modelFormat: "ply",
        collapsed: true,
        expanded: false,
        uploadOrigin,
        createdAt: Date.now(),
      };

      setJobs((prev) => [...prev, queuedJob]);
      pendingRef.current.push({ id, images, uploadOrigin });
      void pumpWorker();

      return { jobId: id, startsNow };
    },
    [pumpWorker]
  );

  const cancelJob = useCallback((id: string) => {
    cancelledRef.current.add(id);
    pendingRef.current = pendingRef.current.filter((w) => w.id !== id);
    setJobs((prev) => prev.filter((j) => j.id !== id));
    clearProgressTracking(id);
    setForegroundJobId((current) => (current === id ? null : current));
  }, [clearProgressTracking]);

  const dismissFailedJob = useCallback((id: string) => {
    cancelledRef.current.add(id);
    setJobs((prev) => prev.filter((j) => j.id !== id));
    clearProgressTracking(id);
  }, [clearProgressTracking]);

  const storeJob = useCallback((id: string) => {
    setJobs((prev) => prev.filter((j) => j.id !== id));
    clearProgressTracking(id);
    setForegroundJobId((current) => (current === id ? null : current));
  }, [clearProgressTracking]);

  const setJobCollapsed = useCallback((id: string, collapsed: boolean) => {
    setJobs((prev) =>
      prev.map((j) =>
        j.id === id
          ? { ...j, collapsed, expanded: collapsed ? false : j.expanded }
          : j
      )
    );
  }, []);

  const setJobExpanded = useCallback((id: string, expanded: boolean) => {
    setJobs((prev) =>
      prev.map((j) => ({
        ...j,
        expanded: j.id === id ? expanded : false,
        collapsed: j.id === id ? !expanded : true,
      }))
    );
  }, []);

  const foregroundJob = jobs.find((j) => j.id === foregroundJobId) ?? null;

  const hasVisibleJobs = jobs.some(
    (j) =>
      isActiveJobStatus(j.status) || j.status === "ready" || j.status === "failed"
  );

  return {
    jobs,
    foregroundJob,
    foregroundJobId,
    setForegroundJobId,
    hasVisibleJobs,
    enqueue,
    cancelJob,
    dismissFailedJob,
    storeJob,
    setJobCollapsed,
    setJobExpanded,
    updateJob,
  };
}