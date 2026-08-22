import { act, renderHook } from '@testing-library/react';
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

  it('keeps an empty in-memory ledger and does not write session history', () => {
    const { result } = renderHook(() => useSessionStats());
    expect(result.current.hasLoadedStats).toBe(true);
    expect(result.current.stats.todayMinutes).toBe(0);
    expect(localStorage.getItem(SESSION_LEDGER_STORAGE_KEY)).toBeNull();
    expect(result.current.ledger.sessions).toHaveLength(0);
  });

  it('clears any prior session ledger blob on module load to free storage quota', async () => {
    localStorage.setItem(SESSION_LEDGER_STORAGE_KEY, JSON.stringify({
      version: 1,
      sessions: [record()],
    }));
    localStorage.setItem(LEGACY_STATS_STORAGE_KEY, JSON.stringify({
      todayMinutes: 17,
      todayBreaths: 44,
      currentStreak: 8,
      lastPracticeDate: '2026-07-29',
    }));

    // Re-import so the module-scope clear runs against the seeded keys.
    vi.resetModules();
    const { useSessionStats: useSessionStatsFresh } = await import('../useSessionStats');
    const { result } = renderHook(() => useSessionStatsFresh());
    expect(result.current.hasLoadedStats).toBe(true);
    expect(localStorage.getItem(SESSION_LEDGER_STORAGE_KEY)).toBeNull();
    expect(localStorage.getItem(LEGACY_STATS_STORAGE_KEY)).toBeNull();
    expect(result.current.stats.todayMinutes).toBe(0);
    expect(result.current.ledger.sessions).toHaveLength(0);
  });

  it('ignores recordSession while persistence is disabled', () => {
    const { result } = renderHook(() => useSessionStats());
    act(() => result.current.recordSession(record()));
    expect(result.current.stats.todayMinutes).toBe(0);
    expect(result.current.ledger.sessions).toHaveLength(0);
    expect(localStorage.getItem(SESSION_LEDGER_STORAGE_KEY)).toBeNull();
  });

  it('validates imports without adopting history while persistence is disabled', () => {
    const { result } = renderHook(() => useSessionStats());
    const payload = JSON.stringify({ version: 1, sessions: [record()] });
    let feedback;
    act(() => { feedback = result.current.importLedgerJson(payload); });
    expect(feedback).toMatchObject({ imported: 0, duplicates: 0, conflicts: 0, baseline: 'identical' });
    expect(result.current.ledger.sessions).toHaveLength(0);
    expect(localStorage.getItem(SESSION_LEDGER_STORAGE_KEY)).toBeNull();
  });

  it('rejects malformed imports without mutating current history', () => {
    const { result } = renderHook(() => useSessionStats());
    const before = result.current.exportLedgerJson();
    expect(() => result.current.importLedgerJson('{nope')).toThrow();
    expect(result.current.exportLedgerJson()).toBe(before);
  });
});
