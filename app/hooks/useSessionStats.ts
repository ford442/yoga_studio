import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  LEGACY_STATS_STORAGE_KEY,
  SESSION_LEDGER_STORAGE_KEY,
  aggregateSessionStats,
  createEmptyLedger,
  getRollingDailyTrends,
  getTechniqueTotals,
  parseLedgerJson,
  validateLedger,
  type MergeResult,
  type SessionLedgerEnvelope,
  type SessionLogEntry,
} from '../lib/sessionLedger';
import { safeRemoveItem } from '../lib/safeStorage';

/**
 * Session history persistence is intentionally disabled until the product is
 * ready to store practice data for users. We still keep an empty in-memory
 * ledger so trends/stats UI and import validation APIs stay wired, but we never
 * read or write the ledger to localStorage — and we clear any prior blob so
 * quota-exhausted browsers can load again.
 */
const clearPersistedSessionHistory = (): void => {
  safeRemoveItem(SESSION_LEDGER_STORAGE_KEY);
  safeRemoveItem(LEGACY_STATS_STORAGE_KEY);
};

export const useSessionStats = () => {
  const [ledger, setLedger] = useState<SessionLedgerEnvelope>(createEmptyLedger);
  const ledgerRef = useRef(ledger);
  const [hasLoadedStats, setHasLoadedStats] = useState(false);

  useEffect(() => {
    clearPersistedSessionHistory();
    const empty = createEmptyLedger();
    ledgerRef.current = empty;
    setLedger(empty);
    setHasLoadedStats(true);
  }, []);

  // Recording is disabled — keep the API but do not mutate history.
  const recordSession = useCallback((_entry: SessionLogEntry) => {
    // no-op: session recording is paused until storage UX is ready
  }, []);

  const importLedgerJson = useCallback((json: string): MergeResult => {
    // Validate only; do not adopt imported history while persistence is off.
    parseLedgerJson(json);
    return {
      envelope: ledgerRef.current,
      imported: 0,
      duplicates: 0,
      conflicts: 0,
      capDiscarded: 0,
      baseline: 'identical',
    };
  }, []);

  const replaceLedgerForRestore = useCallback((_value: unknown) => {
    // Keep empty while persistence is disabled; still validate to surface bad payloads.
    validateLedger(_value);
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
