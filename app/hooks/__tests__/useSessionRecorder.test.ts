import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useSessionRecorder } from '../useSessionRecorder';
import type { CompletedTimerSegment } from '../useBreathTimer';

const settings = { inhale: 4, hold1: 4, exhale: 4, hold2: 4 };

describe('useSessionRecorder', () => {
  it('snapshots mode, settings, and program at segment start', () => {
    const recordSession = vi.fn();
    const initial = {
      activeSegmentId: 1,
      isRunning: true,
      completedSegment: null as CompletedTimerSegment | null,
      modeId: 'classic-mandala',
      programId: 'calm-week' as string | undefined,
      settings,
      recordSession,
    };
    const { rerender } = renderHook((props) => useSessionRecorder(props), { initialProps: initial });
    rerender({
      ...initial,
      isRunning: false,
      modeId: 'ujjayi',
      programId: undefined,
      settings: { inhale: 9, hold1: 0, exhale: 9, hold2: 0 },
      completedSegment: { id: 1, kind: 'timed', endedAt: '2026-07-29T12:05:00.000Z', durationSec: 300, breaths: 18 },
    });
    expect(recordSession).toHaveBeenCalledWith(expect.objectContaining({
      modeId: 'classic-mandala',
      techniqueId: 'classic-mandala',
      programId: 'calm-week',
      settings,
    }));
  });

  it('records multiple free segments and ignores zero-breath completions', () => {
    const recordSession = vi.fn();
    const base = { isRunning: true, modeId: 'ujjayi', settings, recordSession };
    const { rerender } = renderHook((props) => useSessionRecorder(props), {
      initialProps: { ...base, activeSegmentId: 1, completedSegment: null as CompletedTimerSegment | null, programId: undefined as string | undefined },
    });
    rerender({ ...base, activeSegmentId: 1, isRunning: false, programId: undefined, completedSegment: { id: 1, kind: 'free', endedAt: '2026-07-29T12:01:00Z', durationSec: 60, breaths: 0 } });
    expect(recordSession).not.toHaveBeenCalled();

    rerender({ ...base, activeSegmentId: 2, isRunning: true, programId: undefined, completedSegment: null });
    rerender({ ...base, activeSegmentId: 2, isRunning: false, programId: undefined, completedSegment: { id: 2, kind: 'free', endedAt: '2026-07-29T12:02:00Z', durationSec: 60, breaths: 2 } });
    rerender({ ...base, activeSegmentId: 3, isRunning: true, programId: undefined, completedSegment: null });
    rerender({ ...base, activeSegmentId: 3, isRunning: false, programId: undefined, completedSegment: { id: 3, kind: 'free', endedAt: '2026-07-29T12:03:00Z', durationSec: 60, breaths: 3 } });
    expect(recordSession).toHaveBeenCalledTimes(2);
  });
});
