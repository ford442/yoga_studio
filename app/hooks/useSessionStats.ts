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

const readLedger = (): SessionLedgerEnvelope => {
  const stored = localStorage.getItem(SESSION_LEDGER_STORAGE_KEY);
  if (stored) return parseLedgerJson(stored);

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
  localStorage.setItem(SESSION_LEDGER_STORAGE_KEY, JSON.stringify(migrated));
  localStorage.removeItem(LEGACY_STATS_STORAGE_KEY);
  return migrated;
};

export const useSessionStats = () => {
  const [ledger, setLedger] = useState<SessionLedgerEnvelope>(createEmptyLedger);
  const ledgerRef = useRef(ledger);
  const [hasLoadedStats, setHasLoadedStats] = useState(false);

  useEffect(() => {
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
    if (!hasLoadedStats) return;
    localStorage.setItem(SESSION_LEDGER_STORAGE_KEY, JSON.stringify(ledger));
  }, [hasLoadedStats, ledger]);

  const recordSession = useCallback((entry: SessionLogEntry) => {
    const next = appendSession(ledgerRef.current, entry);
    ledgerRef.current = next;
    setLedger(next);
  }, []);

  const importLedgerJson = useCallback((json: string): MergeResult => {
    // Parse and validate before setState so a bad file cannot mutate local data.
    const imported = parseLedgerJson(json);
    const result = mergeLedgers(ledgerRef.current, imported);
    ledgerRef.current = result.envelope;
    setLedger(result.envelope);
    return result;
  }, []);

  const replaceLedgerForRestore = useCallback((value: unknown) => {
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
