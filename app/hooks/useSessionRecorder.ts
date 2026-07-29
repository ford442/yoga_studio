import { useEffect, useRef } from 'react';
import type { BreathSettings, CompletedTimerSegment } from './useBreathTimer';
import type { SessionLogEntry } from '../lib/sessionLedger';

interface UseSessionRecorderOptions {
  activeSegmentId: number;
  isRunning: boolean;
  completedSegment: CompletedTimerSegment | null;
  modeId: string;
  programId?: string;
  settings: BreathSettings;
  recordSession: (entry: SessionLogEntry) => void;
}

interface SegmentSnapshot {
  segmentId: number;
  modeId: string;
  programId?: string;
  settings: BreathSettings;
}

/** Converts timer lifecycle events into immutable, identity-snapshotted ledger records. */
export function useSessionRecorder({
  activeSegmentId,
  isRunning,
  completedSegment,
  modeId,
  programId,
  settings,
  recordSession,
}: UseSessionRecorderOptions): void {
  const snapshotRef = useRef<SegmentSnapshot | null>(null);
  const recordedSegmentIdRef = useRef(0);

  useEffect(() => {
    if (!isRunning || activeSegmentId === 0 || snapshotRef.current?.segmentId === activeSegmentId) return;
    snapshotRef.current = {
      segmentId: activeSegmentId,
      modeId,
      ...(programId ? { programId } : {}),
      settings: { ...settings },
    };
  }, [activeSegmentId, isRunning, modeId, programId, settings]);

  useEffect(() => {
    if (!completedSegment || completedSegment.id === recordedSegmentIdRef.current) return;
    const snapshot = snapshotRef.current;
    if (!snapshot || snapshot.segmentId !== completedSegment.id || completedSegment.breaths < 1) return;
    recordSession({
      endedAt: completedSegment.endedAt,
      durationSec: completedSegment.durationSec,
      breaths: completedSegment.breaths,
      modeId: snapshot.modeId,
      techniqueId: snapshot.modeId,
      ...(snapshot.programId ? { programId: snapshot.programId } : {}),
      settings: snapshot.settings,
    });
    recordedSegmentIdRef.current = completedSegment.id;
  }, [completedSegment, recordSession]);
}
