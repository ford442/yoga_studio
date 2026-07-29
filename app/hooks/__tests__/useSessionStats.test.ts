import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useSessionStats } from '../useSessionStats';
import { LEGACY_STATS_STORAGE_KEY, SESSION_LEDGER_STORAGE_KEY } from '../../lib/sessionLedger';

const record = (endedAt = '2026-07-29T10:00:00.000Z') => ({
  endedAt,
  durationSec: 300,
  breaths: 12,
  modeId: 'ujjayi',
  techniqueId: 'ujjayi',
  programId: 'calm-week',
  settings: { inhale: 4, hold1: 2, exhale: 6, hold2: 2 },
});

describe('useSessionStats', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-07-29T12:00:00.000Z'));
    localStorage.clear();
  });

  afterEach(() => vi.useRealTimers());

  it('hydrates safely from an empty post-mount ledger', async () => {
    const { result } = renderHook(() => useSessionStats());
    expect(result.current.stats.todayMinutes).toBe(0);
    await waitFor(() => expect(result.current.hasLoadedStats).toBe(true));
    expect(JSON.parse(localStorage.getItem(SESSION_LEDGER_STORAGE_KEY) ?? '{}')).toMatchObject({ version: 1, sessions: [] });
  });

  it('migrates legacy stats exactly and removes the old key only after writing', async () => {
    localStorage.setItem(LEGACY_STATS_STORAGE_KEY, JSON.stringify({
      todayMinutes: 17,
      todayBreaths: 44,
      currentStreak: 8,
      lastPracticeDate: '2026-07-29',
    }));
    const { result } = renderHook(() => useSessionStats());
    await waitFor(() => expect(result.current.stats.todayMinutes).toBe(17));
    expect(result.current.stats.todayBreaths).toBe(44);
    expect(localStorage.getItem(LEGACY_STATS_STORAGE_KEY)).toBeNull();
    expect(JSON.parse(localStorage.getItem(SESSION_LEDGER_STORAGE_KEY) ?? '{}').legacyBaseline.currentStreak).toBe(8);
  });

  it('records and persists a complete session across remounts', async () => {
    const first = renderHook(() => useSessionStats());
    await waitFor(() => expect(first.result.current.hasLoadedStats).toBe(true));
    act(() => first.result.current.recordSession(record()));
    await waitFor(() => expect(first.result.current.stats.todayMinutes).toBe(5));
    first.unmount();

    const second = renderHook(() => useSessionStats());
    await waitFor(() => expect(second.result.current.stats.todayBreaths).toBe(12));
    expect(second.result.current.ledger.sessions[0]).toMatchObject({ modeId: 'ujjayi', programId: 'calm-week' });
  });

  it('round-trips exported JSON after storage is cleared', async () => {
    const first = renderHook(() => useSessionStats());
    await waitFor(() => expect(first.result.current.hasLoadedStats).toBe(true));
    act(() => first.result.current.recordSession(record()));
    await waitFor(() => expect(first.result.current.ledger.sessions).toHaveLength(1));
    const backup = first.result.current.exportLedgerJson();
    first.unmount();
    localStorage.clear();

    const second = renderHook(() => useSessionStats());
    await waitFor(() => expect(second.result.current.hasLoadedStats).toBe(true));
    let feedback;
    act(() => { feedback = second.result.current.importLedgerJson(backup); });
    expect(feedback).toMatchObject({ imported: 1, duplicates: 0, conflicts: 0 });
    await waitFor(() => expect(second.result.current.stats.todayBreaths).toBe(12));
  });

  it('rejects malformed imports without mutating current history', async () => {
    const { result } = renderHook(() => useSessionStats());
    await waitFor(() => expect(result.current.hasLoadedStats).toBe(true));
    act(() => result.current.recordSession(record()));
    const before = result.current.exportLedgerJson();
    expect(() => result.current.importLedgerJson('{nope')).toThrow();
    expect(result.current.exportLedgerJson()).toBe(before);
  });
});
