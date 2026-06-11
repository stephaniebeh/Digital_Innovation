import type { AholoModelFormat } from "@/lib/aholo/model-url";

export type ReconstructionJobStatus =
  | "queued"
  | "uploading"
  | "processing"
  | "ready"
  | "failed";

export type ReconstructionJob = {
  id: string;
  imageCount: number;
  label: string;
  status: ReconstructionJobStatus;
  stageIndex: number;
  progress: number;
  statusLine: string | null;
  error: string | null;
  splatUrl: string | null;
  modelFormat: AholoModelFormat;
  collapsed: boolean;
  expanded: boolean;
  uploadOrigin: "public" | "private";
  createdAt: number;
};

export const PROGRESS_BANDS = {
  uploadMin: 0.02,
  uploadMax: 0.28,
  processingMin: 0.3,
  pendingMax: 0.58,
  runningMax: 0.88,
  packaging: 0.94,
  done: 1,
} as const;

export type AholoPollSnapshot = {
  status: string;
  createTime?: number;
  updateTime?: number;
};

export function createJobId(): string {
  return `job-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function jobLabel(imageCount: number): string {
  return `${imageCount} photo${imageCount === 1 ? "" : "s"}`;
}

export function stageIndexForStatus(
  status: string | null,
  uploading: boolean
): number {
  if (uploading) return 1;
  if (status?.startsWith("SUCCEEDED")) return 3;
  switch (status) {
    case "PENDING":
      return 2;
    case "RUNNING":
      return 2;
    default:
      return 2;
  }
}

export function progressFromUploadRatio(ratio: number): number {
  const r = clampProgress(ratio);
  return (
    PROGRESS_BANDS.uploadMin +
    r * (PROGRESS_BANDS.uploadMax - PROGRESS_BANDS.uploadMin)
  );
}

export function estimateAholoProgress(
  snapshot: AholoPollSnapshot,
  imageCount: number,
  processingStartedAt: number
): number {
  const status = snapshot.status;
  if (status.startsWith("SUCCEEDED")) return PROGRESS_BANDS.packaging;

  const floor =
    status === "RUNNING"
      ? PROGRESS_BANDS.pendingMax
      : PROGRESS_BANDS.processingMin;
  const ceiling =
    status === "RUNNING" ? PROGRESS_BANDS.runningMax : PROGRESS_BANDS.pendingMax;

  const expectedMs = Math.min(
    12 * 60_000,
    90_000 + imageCount * 2_500
  );
  const elapsedMs =
    snapshot.createTime && snapshot.updateTime
      ? snapshot.updateTime - snapshot.createTime
      : Date.now() - processingStartedAt;

  const t = Math.min(1, Math.max(0, elapsedMs / expectedMs));
  return floor + t * (ceiling - floor);
}

export function friendlyReconStatus(status: string): string {
  if (status.startsWith("SUCCEEDED — waiting")) {
    return "Packaging your memory.";
  }
  switch (status) {
    case "PENDING":
      return "Waiting in Aholo queue.";
    case "RUNNING":
      return "Building your memory.";
    case "SUCCEEDED":
      return "Almost ready.";
    default:
      if (status.toLowerCase().includes("upload")) return "Uploading photos.";
      return "Processing.";
  }
}

export function clampProgress(progress: number): number {
  if (!Number.isFinite(progress)) return 0;
  return Math.max(0, Math.min(1, progress));
}

export function advanceProgress(current: number, next: number): number {
  return clampProgress(Math.max(current, next));
}

export function formatJobProgress(progress: number): number {
  return Math.round(clampProgress(progress) * 100);
}

export function isActiveJobStatus(status: ReconstructionJobStatus): boolean {
  return status === "queued" || status === "uploading" || status === "processing";
}

export function visibleJobs(jobs: ReconstructionJob[]): ReconstructionJob[] {
  return jobs.filter(
    (j) => isActiveJobStatus(j.status) || j.status === "ready" || j.status === "failed"
  );
}