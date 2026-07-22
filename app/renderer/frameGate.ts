/**
 * Shared render-loop helpers: visibility pause and governor-driven frame timing.
 * Backends call `beginFrame` each rAF tick and bail when it returns null.
 */

import type { GovernorSnapshot } from './frameGovernor';
import type { RendererBackendContext } from './types';

export interface FrameGateResult {
  now: number;
  deltaMs: number;
  governor: GovernorSnapshot & { changed: boolean };
}

/** Attach a visibility listener that cancels / restarts the rAF loop. */
export function attachVisibilityPause(onHidden: () => void, onVisible: () => void): () => void {
  if (typeof document === 'undefined') return () => {};

  const handler = () => {
    if (document.visibilityState === 'hidden') onHidden();
    else onVisible();
  };

  document.addEventListener('visibilitychange', handler);
  if (document.visibilityState === 'hidden') onHidden();

  return () => document.removeEventListener('visibilitychange', handler);
}

/** Sample frame delta, feed the governor, and decide whether to draw. */
export function beginFrame(
  ctx: RendererBackendContext,
  lastFrameMs: number | null,
): FrameGateResult | null {
  const now = performance.now();
  const deltaMs = lastFrameMs == null ? 16.7 : now - lastFrameMs;

  const hidden = typeof document !== 'undefined' && document.visibilityState === 'hidden';
  const allowDraw = !hidden && ctx.shouldRender();
  ctx.governor.setPaused(!allowDraw);

  const governor = ctx.governor.noteFrame(now, deltaMs);
  if (governor.changed) ctx.onGovernorChange?.();

  if (!allowDraw) return null;
  return { now, deltaMs, governor };
}
