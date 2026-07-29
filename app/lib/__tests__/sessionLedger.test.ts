import { describe, expect, it } from 'vitest';
import {
  SESSION_LEDGER_LIMIT,
  aggregateSessionStats,
  appendSession,
  createEmptyLedger,
  getRollingDailyTrends,
  getTechniqueTotals,
  mergeLedgers,
  migrateLegacyStats,
  parseLedgerJson,
  validateLedger,
  type SessionLedgerEnvelope,
  type SessionLogEntry,
} from '../sessionLedger';

const entry = (endedAt: string, overrides: Partial<SessionLogEntry> = {}): SessionLogEntry => ({
  endedAt,
  durationSec: 300,
  breaths: 10,
  modeId: 'classic-mandala',
  techniqueId: 'classic-mandala',
  settings: { inhale: 4, hold1: 4, exhale: 4, hold2: 4 },
  ...overrides,
});

const envelope = (sessions: SessionLogEntry[], legacyBaseline?: SessionLedgerEnvelope['legacyBaseline']): SessionLedgerEnvelope => ({
  version: 1,
  sessions,
  ...(legacyBaseline ? { legacyBaseline } : {}),
});

describe('sessionLedger', () => {
  it('appends immutably in newest-first order and skips exact timestamps', () => {
    const initial = envelope([entry('2026-07-20T10:00:00.000Z')]);
    const next = appendSession(initial, entry('2026-07-21T10:00:00.000Z'));
    expect(next).not.toBe(initial);
    expect(initial.sessions).toHaveLength(1);
    expect(next.sessions.map((item) => item.endedAt)).toEqual([
      '2026-07-21T10:00:00.000Z',
      '2026-07-20T10:00:00.000Z',
    ]);
    expect(appendSession(next, entry('2026-07-21T10:00:00.000Z'))).toBe(next);
  });

  it('keeps only the newest 500 appended sessions', () => {
    let current = createEmptyLedger();
    for (let index = 0; index < SESSION_LEDGER_LIMIT + 3; index += 1) {
      current = appendSession(current, entry(new Date(Date.UTC(2026, 0, 1, 0, index)).toISOString()));
    }
    expect(current.sessions).toHaveLength(SESSION_LEDGER_LIMIT);
    expect(current.sessions[0].endedAt).toBe(new Date(Date.UTC(2026, 0, 1, 0, 502)).toISOString());
  });

  it('merges by exact timestamp with local entries winning duplicate conflicts', () => {
    const localEntry = entry('2026-07-20T10:00:00.000Z');
    const duplicate = { ...localEntry, settings: { ...localEntry.settings } };
    const conflict = entry(localEntry.endedAt, { breaths: 99 });
    const added = entry('2026-07-21T10:00:00.000Z', { techniqueId: 'ujjayi' });
    const duplicateResult = mergeLedgers(envelope([localEntry]), envelope([duplicate, added]));
    expect(duplicateResult).toMatchObject({ imported: 1, duplicates: 1, conflicts: 0, capDiscarded: 0 });

    const conflictResult = mergeLedgers(envelope([localEntry]), envelope([conflict]));
    expect(conflictResult.conflicts).toBe(1);
    expect(conflictResult.envelope.sessions[0].breaths).toBe(10);
  });

  it('reports cap discards for oversized imports and preserves newest records', () => {
    const imported = Array.from({ length: 505 }, (_, index) =>
      entry(new Date(Date.UTC(2026, 0, 1, 0, index)).toISOString()),
    );
    const parsed = parseLedgerJson(JSON.stringify(envelope(imported)));
    const result = mergeLedgers(createEmptyLedger(), parsed);
    expect(result.envelope.sessions).toHaveLength(500);
    expect(result.imported).toBe(500);
    expect(result.capDiscarded).toBe(5);
  });

  it('migrates and preserves an exact legacy baseline', () => {
    const baseline = { todayMinutes: 17, todayBreaths: 42, currentStreak: 6, lastPracticeDate: '2026-07-20' };
    expect(migrateLegacyStats(baseline)).toEqual(envelope([], baseline));
    expect(migrateLegacyStats({ ...baseline, currentStreak: -1 })).toBeNull();
  });

  it('adopts only a missing baseline and reports identical or conflicting baselines', () => {
    const first = { todayMinutes: 4, todayBreaths: 12, currentStreak: 2, lastPracticeDate: '2026-07-20' };
    const second = { ...first, todayMinutes: 9 };
    expect(mergeLedgers(createEmptyLedger(), envelope([], first)).baseline).toBe('adopted');
    expect(mergeLedgers(envelope([], first), envelope([], first)).baseline).toBe('identical');
    const result = mergeLedgers(envelope([], first), envelope([], second));
    expect(result.baseline).toBe('conflict');
    expect(result.envelope.legacyBaseline).toEqual(first);
  });

  it('derives UTC daily totals by summing duration before rounding', () => {
    const ledger = envelope([
      entry('2026-07-20T23:59:59.000Z', { durationSec: 40, breaths: 2 }),
      entry('2026-07-20T01:00:00.000Z', { durationSec: 80, breaths: 3 }),
      entry('2026-07-19T23:59:59.000Z', { durationSec: 600, breaths: 20 }),
    ]);
    expect(aggregateSessionStats(ledger, new Date('2026-07-20T12:00:00.000Z'))).toMatchObject({
      todayMinutes: 2,
      todayBreaths: 5,
    });
  });

  it('keeps legacy streak transitions identical across same day, yesterday, and a gap', () => {
    const baseline = { todayMinutes: 2, todayBreaths: 4, currentStreak: 5, lastPracticeDate: '2026-07-18' };
    expect(aggregateSessionStats(envelope([entry('2026-07-18T15:00:00.000Z')], baseline), new Date('2026-07-18T20:00:00Z')).currentStreak).toBe(5);
    expect(aggregateSessionStats(envelope([entry('2026-07-19T15:00:00.000Z')], baseline), new Date('2026-07-19T20:00:00Z')).currentStreak).toBe(6);
    expect(aggregateSessionStats(envelope([entry('2026-07-21T15:00:00.000Z')], baseline), new Date('2026-07-21T20:00:00Z')).currentStreak).toBe(1);
  });

  it('builds 28 real-session UTC buckets without attributing the legacy baseline', () => {
    const baseline = { todayMinutes: 30, todayBreaths: 50, currentStreak: 4, lastPracticeDate: '2026-07-28' };
    const trends = getRollingDailyTrends(envelope([
      entry('2026-07-28T23:00:00.000Z', { durationSec: 901 }),
    ], baseline), 28, new Date('2026-07-29T12:00:00.000Z'));
    expect(trends).toHaveLength(28);
    expect(trends.at(-2)).toEqual({ date: '2026-07-28', durationSec: 901, minutes: 15 });
    expect(trends.at(-1)?.date).toBe('2026-07-29');
  });

  it('sorts technique totals by exact duration with ID fallback data intact', () => {
    const totals = getTechniqueTotals(envelope([
      entry('2026-07-20T10:00:00.000Z', { techniqueId: 'ujjayi', durationSec: 300 }),
      entry('2026-07-21T10:00:00.000Z', { techniqueId: 'unknown-technique', durationSec: 700 }),
    ]));
    expect(totals.map((total) => total.techniqueId)).toEqual(['unknown-technique', 'ujjayi']);
  });

  it('rejects malformed, unsupported, duplicate, and invalid-entry files atomically', () => {
    expect(() => parseLedgerJson('{bad')).toThrow('not valid JSON');
    expect(() => parseLedgerJson(JSON.stringify({ version: 2, sessions: [] }))).toThrow('Unsupported');
    expect(() => validateLedger(envelope([entry('2026-07-20T10:00:00Z'), entry('2026-07-20T10:00:00Z')]))).toThrow('duplicate');
    expect(() => validateLedger(envelope([entry('2026-07-20T10:00:00Z', { breaths: 0 })]))).toThrow('invalid record');
  });
});
