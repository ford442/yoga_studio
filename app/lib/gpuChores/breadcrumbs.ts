import type { ChoreJobKind, ChoresBackend } from './types';

export interface ChoreBreadcrumb {
  job: ChoreJobKind;
  backend: ChoresBackend;
  reason: string;
  pixels: number;
  durationMs: number;
  /** Set when the WebGPU attempt threw and a CPU tier finished the job. */
  gpuError?: string;
  timestamp: number;
}

const MAX_BREADCRUMBS = 20;
const breadcrumbs: ChoreBreadcrumb[] = [];

/** Latest chore status, read by the diagnostics panel. */
export interface ChoresStatus {
  backend: ChoresBackend | null;
  reason: string;
  jobCount: number;
}

let status: ChoresStatus = { backend: null, reason: 'no chores run yet', jobCount: 0 };

export function recordChoreBreadcrumb(crumb: ChoreBreadcrumb): void {
  breadcrumbs.push(crumb);
  if (breadcrumbs.length > MAX_BREADCRUMBS) breadcrumbs.shift();
  status = {
    backend: crumb.backend,
    reason: crumb.gpuError ? `${crumb.reason} → fell back (${crumb.gpuError})` : crumb.reason,
    jobCount: status.jobCount + 1,
  };
  if (typeof window !== 'undefined') {
    (window as Window & { gpuChores?: { status: ChoresStatus; breadcrumbs: ChoreBreadcrumb[] } }).gpuChores = {
      status,
      breadcrumbs: [...breadcrumbs],
    };
  }
}

export function getChoresStatus(): ChoresStatus {
  return status;
}

export function getChoreBreadcrumbs(): readonly ChoreBreadcrumb[] {
  return breadcrumbs;
}

/** Test seam: forget everything recorded so far. */
export function resetChoreBreadcrumbs(): void {
  breadcrumbs.length = 0;
  status = { backend: null, reason: 'no chores run yet', jobCount: 0 };
}
