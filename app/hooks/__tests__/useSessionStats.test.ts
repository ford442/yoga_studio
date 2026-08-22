import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SESSION_LEDGER_PERSISTENCE_ENABLED, useSessionStats } from '../useSessionStats';
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

  it('clears any prior ledger keys and stays empty while persistence is disabled', async () => {
    expect(SESSION_LEDGER_PERSISTENCE_ENABLED).toBe(false);
    localStorage.setItem(
      SESSION_LEDGER_STORAGE_KEY,
      JSON.stringify({
        version: 1,
        sessions: [record()],
      }),
    );
    localStorage.setItem(
      LEGACY_STATS_STORAGE_KEY,
      JSON.stringify({
        todayMinutes: 17,
        todayBreaths: 44,
        currentStreak: 8,
        lastPracticeDate: '2026-07-29',
      }),
    );

    const { result } = renderHook(() => useSessionStats());
    expect(result.current.stats.todayMinutes).toBe(0);
    await waitFor(() => expect(result.current.hasLoadedStats).toBe(true));
    expect(result.current.ledger.sessions).toHaveLength(0);
    expect(localStorage.getItem(SESSION_LEDGER_STORAGE_KEY)).toBeNull();
    expect(localStorage.getItem(LEGACY_STATS_STORAGE_KEY)).toBeNull();
  });

  it('does not record or persist sessions while persistence is disabled', async () => {
    const { result } = renderHook(() => useSessionStats());
    await waitFor(() => expect(result.current.hasLoadedStats).toBe(true));
    act(() => result.current.recordSession(record()));
    expect(result.current.ledger.sessions).toHaveLength(0);
    expect(result.current.stats.todayBreaths).toBe(0);
    expect(localStorage.getItem(SESSION_LEDGER_STORAGE_KEY)).toBeNull();
  });

  it('rejects import mutations while persistence is disabled', async () => {
    const { result } = renderHook(() => useSessionStats());
    await waitFor(() => expect(result.current.hasLoadedStats).toBe(true));
    const backup = JSON.stringify({
      version: 1,
      sessions: [record()],
    });
    let feedback;
    act(() => {
      feedback = result.current.importLedgerJson(backup);
    });
    expect(feedback).toMatchObject({ imported: 0, baseline: 'none' });
    expect(result.current.ledger.sessions).toHaveLength(0);
    expect(localStorage.getItem(SESSION_LEDGER_STORAGE_KEY)).toBeNull();
  });

  it('still rejects malformed imports without mutating current history', async () => {
    const { result } = renderHook(() => useSessionStats());
    await waitFor(() => expect(result.current.hasLoadedStats).toBe(true));
    const before = result.current.exportLedgerJson();
    expect(() => result.current.importLedgerJson('{nope')).toThrow();
    expect(result.current.exportLedgerJson()).toBe(before);
  });
});
