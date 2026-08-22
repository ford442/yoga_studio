import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  LEGACY_STATS_STORAGE_KEY,
  SESSION_LEDGER_STORAGE_KEY,
  aggregateSessionStats,
  appendSession,
  createEmptyLedger,
  getRollingDailyTrends,
  getTechniqueTotals,
  mergeLedgers,
  migrateLegacyStats,
  parseLedgerJson,
  validateLedger,
  type MergeResult,
  type SessionLedgerEnvelope,
  type SessionLogEntry,
} from '../lib/sessionLedger';

/**
 * Practice-history persistence is disabled until the product is ready to retain
 * sessions for users. Keep the in-memory API so UI can stay wired, but do not
 * read or write the ledger — and clear any prior payload to free quota.
 */
export const SESSION_LEDGER_PERSISTENCE_ENABLED = false;

const isQuotaExceededError = (error: unknown): boolean => {
  if (!(error instanceof DOMException)) return false;
  return (
    error.name === 'QuotaExceededError' ||
    error.name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
    error.code === 22 ||
    error.code === 1014
  );
};

/** Drop any previously stored ledger/legacy stats so browsers stuck at quota can recover. */
const clearStoredSessionHistory = (): void => {
  try {
    localStorage.removeItem(SESSION_LEDGER_STORAGE_KEY);
    localStorage.removeItem(LEGACY_STATS_STORAGE_KEY);
  } catch {
    // ignore — Storage may be unavailable in private mode
  }
};

// Retries the write, aggressively dropping the oldest (tail) sessions on
// quota errors until it fits or nothing is left to trim.
const persistLedger = (envelope: SessionLedgerEnvelope): SessionLedgerEnvelope | null => {
  let candidate = envelope;
  for (;;) {
    try {
      localStorage.setItem(SESSION_LEDGER_STORAGE_KEY, JSON.stringify(candidate));
      return candidate;
    } catch (error) {
      if (!isQuotaExceededError(error) || candidate.sessions.length === 0) {
        console.warn('Unable to persist sacred-breath session history to localStorage.', error);
        return null;
      }
      const nextLength = Math.floor(candidate.sessions.length / 2);
      candidate = { ...candidate, sessions: candidate.sessions.slice(0, nextLength) };
    }
  }
};

const readLedger = (): SessionLedgerEnvelope => {
  const stored = localStorage.getItem(SESSION_LEDGER_STORAGE_KEY);
  if (stored) {
    try {
      return parseLedgerJson(stored);
    } catch {
      console.warn('Invalid sacred-breath session history localStorage payload; clearing it.');
      localStorage.removeItem(SESSION_LEDGER_STORAGE_KEY);
      return createEmptyLedger();
    }
  }

  const legacyRaw = localStorage.getItem(LEGACY_STATS_STORAGE_KEY);
  if (!legacyRaw) return createEmptyLedger();

  let migrated: SessionLedgerEnvelope | null = null;
  try {
    migrated = migrateLegacyStats(JSON.parse(legacyRaw) as unknown);
  } catch {
    // The legacy payload remains untouched when it cannot be migrated.
  }
  if (!migrated) return createEmptyLedger();

  // Removal happens only after the durable replacement write succeeds.
  const persisted = persistLedger(migrated);
  if (!persisted) return migrated;
  localStorage.removeItem(LEGACY_STATS_STORAGE_KEY);
  return persisted;
};

export const useSessionStats = () => {
  const [ledger, setLedger] = useState<SessionLedgerEnvelope>(createEmptyLedger);
  const ledgerRef = useRef(ledger);
  const [hasLoadedStats, setHasLoadedStats] = useState(false);

  useEffect(() => {
    // Always clear stale history keys first — oversized ledgers have crashed
    // Edge/Chromium loads via QuotaExceededError on unrelated setItem calls.
    clearStoredSessionHistory();

    if (!SESSION_LEDGER_PERSISTENCE_ENABLED) {
      ledgerRef.current = createEmptyLedger();
      setLedger(createEmptyLedger());
      setHasLoadedStats(true);
      return;
    }

    try {
      const loaded = readLedger();
      ledgerRef.current = loaded;
      setLedger(loaded);
    } catch {
      console.warn('Invalid sacred-breath session history localStorage payload');
      setLedger(createEmptyLedger());
    } finally {
      setHasLoadedStats(true);
    }
  }, []);

  useEffect(() => {
    if (!SESSION_LEDGER_PERSISTENCE_ENABLED || !hasLoadedStats) return;
    const persisted = persistLedger(ledger);
    // Trimming happened to fit under quota; sync state so the UI matches
    // what is actually durable and future appends build on the right base.
    if (persisted && persisted !== ledger) {
      ledgerRef.current = persisted;
      setLedger(persisted);
    }
  }, [hasLoadedStats, ledger]);

  const recordSession = useCallback((entry: SessionLogEntry) => {
    if (!SESSION_LEDGER_PERSISTENCE_ENABLED) return;
    const next = appendSession(ledgerRef.current, entry);
    ledgerRef.current = next;
    setLedger(next);
  }, []);

  const importLedgerJson = useCallback((json: string): MergeResult => {
    // Parse and validate before setState so a bad file cannot mutate local data.
    const imported = parseLedgerJson(json);
    if (!SESSION_LEDGER_PERSISTENCE_ENABLED) {
      return {
        envelope: ledgerRef.current,
        imported: 0,
        duplicates: 0,
        conflicts: 0,
        capDiscarded: 0,
        baseline: 'none',
      };
    }
    const result = mergeLedgers(ledgerRef.current, imported);
    ledgerRef.current = result.envelope;
    setLedger(result.envelope);
    return result;
  }, []);

  const replaceLedgerForRestore = useCallback((value: unknown) => {
    if (!SESSION_LEDGER_PERSISTENCE_ENABLED) return;
    const restored = validateLedger(value);
    ledgerRef.current = restored;
    setLedger(restored);
  }, []);

  const stats = useMemo(() => aggregateSessionStats(ledger), [ledger]);
  const trends = useMemo(() => getRollingDailyTrends(ledger), [ledger]);
  const techniqueTotals = useMemo(() => getTechniqueTotals(ledger), [ledger]);

  return {
    stats,
    ledger,
    trends,
    techniqueTotals,
    hasLoadedStats,
    recordSession,
    exportLedgerJson: () => JSON.stringify(ledger, null, 2),
    importLedgerJson,
    replaceLedgerForRestore,
  };
};
