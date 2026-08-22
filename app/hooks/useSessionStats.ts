import { useCallback, useEffect, useMemo } from 'react';
import {
  LEGACY_STATS_STORAGE_KEY,
  SESSION_LEDGER_STORAGE_KEY,
  aggregateSessionStats,
  createEmptyLedger,
  getRollingDailyTrends,
  getTechniqueTotals,
  parseLedgerJson,
  type MergeResult,
  type SessionLogEntry,
} from '../lib/sessionLedger';
import { safeRemoveItem } from '../lib/safeStorage';

/**
 * Practice-history persistence is disabled until the product is ready to retain
 * sessions for users. Keep the in-memory API so UI can stay wired, but do not
 * read or write the ledger — and clear any prior payload to free quota.
 *
 * Flip this to true and restore the previous localStorage read/write path in
 * git history when session recording ships.
 */
export const SESSION_LEDGER_PERSISTENCE_ENABLED = false;

/** Drop any previously stored ledger/legacy stats so browsers stuck at quota can recover. */
const clearStoredSessionHistory = (): void => {
  safeRemoveItem(SESSION_LEDGER_STORAGE_KEY);
  safeRemoveItem(LEGACY_STATS_STORAGE_KEY);
};

const EMPTY_IMPORT_RESULT = (envelope: ReturnType<typeof createEmptyLedger>): MergeResult => ({
  envelope,
  imported: 0,
  duplicates: 0,
  conflicts: 0,
  capDiscarded: 0,
  baseline: 'none',
});

export const useSessionStats = () => {
  const ledger = useMemo(() => createEmptyLedger(), []);
  const stats = useMemo(() => aggregateSessionStats(ledger), [ledger]);
  const trends = useMemo(() => getRollingDailyTrends(ledger), [ledger]);
  const techniqueTotals = useMemo(() => getTechniqueTotals(ledger), [ledger]);

  useEffect(() => {
    // Oversized ledgers have crashed Edge/Chromium loads via QuotaExceededError
    // on unrelated setItem calls — wipe them on every mount while persistence is off.
    clearStoredSessionHistory();
  }, []);

  const recordSession = useCallback((entry: SessionLogEntry) => {
    void entry;
  }, []);

  const importLedgerJson = useCallback((json: string): MergeResult => {
    // Still validate so the settings UI can surface malformed files.
    parseLedgerJson(json);
    return EMPTY_IMPORT_RESULT(ledger);
  }, [ledger]);

  const replaceLedgerForRestore = useCallback((value: unknown) => {
    void value;
  }, []);

  return {
    stats,
    ledger,
    trends,
    techniqueTotals,
    hasLoadedStats: true,
    recordSession,
    exportLedgerJson: () => JSON.stringify(ledger, null, 2),
    importLedgerJson,
    replaceLedgerForRestore,
  };
};

