import type { BreathSettings } from '../hooks/useBreathTimer';

export const SESSION_LEDGER_VERSION = 1 as const;
export const SESSION_LEDGER_LIMIT = 500;
export const SESSION_LEDGER_STORAGE_KEY = 'sacred-breath-session-ledger';
export const LEGACY_STATS_STORAGE_KEY = 'sacred-breath-stats';

export interface SessionLogEntry {
  endedAt: string;
  durationSec: number;
  breaths: number;
  modeId: string;
  techniqueId: string;
  programId?: string;
  settings: BreathSettings;
}

export interface LegacyStatsBaseline {
  todayMinutes: number;
  todayBreaths: number;
  currentStreak: number;
  lastPracticeDate: string;
}

export interface SessionLedgerEnvelope {
  version: typeof SESSION_LEDGER_VERSION;
  sessions: SessionLogEntry[];
  legacyBaseline?: LegacyStatsBaseline;
}

export interface SessionStats {
  todayMinutes: number;
  todayBreaths: number;
  currentStreak: number;
  lastPracticeDate: string;
}

export interface DailyTrend {
  date: string;
  durationSec: number;
  minutes: number;
}

export interface TechniqueTotal {
  techniqueId: string;
  durationSec: number;
  minutes: number;
  breaths: number;
}

export interface MergeResult {
  envelope: SessionLedgerEnvelope;
  imported: number;
  duplicates: number;
  conflicts: number;
  capDiscarded: number;
  baseline: 'adopted' | 'identical' | 'conflict' | 'none';
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const SETTINGS_KEYS: (keyof BreathSettings)[] = ['inhale', 'hold1', 'exhale', 'hold2'];

export const utcDateKey = (date: Date | string | number = new Date()): string =>
  new Date(date).toISOString().slice(0, 10);

export const createEmptyLedger = (): SessionLedgerEnvelope => ({
  version: SESSION_LEDGER_VERSION,
  sessions: [],
});

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isNonNegativeInteger = (value: unknown): value is number =>
  typeof value === 'number' && Number.isInteger(value) && value >= 0;

const isValidDateKey = (value: unknown): value is string => {
  if (typeof value !== 'string' || !DATE_RE.test(value)) return false;
  return utcDateKey(`${value}T00:00:00.000Z`) === value;
};

const isValidTimestamp = (value: unknown): value is string =>
  typeof value === 'string' && value.length > 0 && Number.isFinite(Date.parse(value));

const parseSettings = (value: unknown): BreathSettings | null => {
  if (!isRecord(value)) return null;
  const parsed = {} as BreathSettings;
  for (const key of SETTINGS_KEYS) {
    const field = value[key];
    if (typeof field !== 'number' || !Number.isFinite(field) || field < 0) return null;
    parsed[key] = field;
  }
  return parsed;
};

const parseEntry = (value: unknown): SessionLogEntry | null => {
  if (!isRecord(value)) return null;
  const settings = parseSettings(value.settings);
  if (
    !isValidTimestamp(value.endedAt) ||
    !isNonNegativeInteger(value.durationSec) || value.durationSec === 0 ||
    !isNonNegativeInteger(value.breaths) || value.breaths === 0 ||
    typeof value.modeId !== 'string' || value.modeId.length === 0 ||
    typeof value.techniqueId !== 'string' || value.techniqueId.length === 0 ||
    (value.programId !== undefined && (typeof value.programId !== 'string' || value.programId.length === 0)) ||
    !settings
  ) return null;

  return {
    endedAt: value.endedAt,
    durationSec: value.durationSec,
    breaths: value.breaths,
    modeId: value.modeId,
    techniqueId: value.techniqueId,
    ...(value.programId === undefined ? {} : { programId: value.programId }),
    settings,
  };
};

export const parseLegacyBaseline = (value: unknown): LegacyStatsBaseline | null => {
  if (!isRecord(value)) return null;
  if (
    !isNonNegativeInteger(value.todayMinutes) ||
    !isNonNegativeInteger(value.todayBreaths) ||
    !isNonNegativeInteger(value.currentStreak) ||
    !isValidDateKey(value.lastPracticeDate)
  ) return null;
  return {
    todayMinutes: value.todayMinutes,
    todayBreaths: value.todayBreaths,
    currentStreak: value.currentStreak,
    lastPracticeDate: value.lastPracticeDate,
  };
};

const parseLedger = (value: unknown, capSessions: boolean): SessionLedgerEnvelope => {
  if (!isRecord(value) || value.version !== SESSION_LEDGER_VERSION || !Array.isArray(value.sessions)) {
    throw new Error('Unsupported or malformed session history file.');
  }
  const sessions = value.sessions.map((entry) => {
    const parsed = parseEntry(entry);
    if (!parsed) throw new Error('Session history contains an invalid record.');
    return parsed;
  });
  if (new Set(sessions.map((entry) => entry.endedAt)).size !== sessions.length) {
    throw new Error('Session history contains duplicate timestamps.');
  }
  const legacyBaseline = value.legacyBaseline === undefined
    ? undefined
    : parseLegacyBaseline(value.legacyBaseline);
  if (value.legacyBaseline !== undefined && !legacyBaseline) {
    throw new Error('Session history contains an invalid legacy baseline.');
  }
  const parsed = { version: SESSION_LEDGER_VERSION, sessions, ...(legacyBaseline ? { legacyBaseline } : {}) };
  return capSessions
    ? sortAndCap(parsed)
    : { ...parsed, sessions: [...sessions].sort((a, b) => Date.parse(b.endedAt) - Date.parse(a.endedAt) || b.endedAt.localeCompare(a.endedAt)) };
};

export const validateLedger = (value: unknown): SessionLedgerEnvelope => parseLedger(value, true);

export const parseLedgerJson = (json: string): SessionLedgerEnvelope => {
  let value: unknown;
  try {
    value = JSON.parse(json) as unknown;
  } catch {
    throw new Error('The selected file is not valid JSON.');
  }
  return parseLedger(value, false);
};

const sortAndCap = (envelope: SessionLedgerEnvelope): SessionLedgerEnvelope => ({
  ...envelope,
  sessions: [...envelope.sessions]
    .sort((a, b) => Date.parse(b.endedAt) - Date.parse(a.endedAt) || b.endedAt.localeCompare(a.endedAt))
    .slice(0, SESSION_LEDGER_LIMIT),
});

export const appendSession = (
  envelope: SessionLedgerEnvelope,
  entry: SessionLogEntry,
): SessionLedgerEnvelope => {
  const parsed = parseEntry(entry);
  if (!parsed) return envelope;
  if (envelope.sessions.some((existing) => existing.endedAt === parsed.endedAt)) return envelope;
  return sortAndCap({ ...envelope, sessions: [...envelope.sessions, parsed] });
};

const sameJson = (a: unknown, b: unknown): boolean => JSON.stringify(a) === JSON.stringify(b);

export const mergeLedgers = (
  local: SessionLedgerEnvelope,
  imported: SessionLedgerEnvelope,
): MergeResult => {
  const byTimestamp = new Map(local.sessions.map((entry) => [entry.endedAt, entry]));
  let duplicates = 0;
  let conflicts = 0;
  const added: SessionLogEntry[] = [];
  for (const entry of imported.sessions) {
    const existing = byTimestamp.get(entry.endedAt);
    if (existing) {
      if (sameJson(existing, entry)) duplicates += 1;
      else conflicts += 1;
      continue;
    }
    byTimestamp.set(entry.endedAt, entry);
    added.push(entry);
  }

  let legacyBaseline = local.legacyBaseline;
  let baseline: MergeResult['baseline'] = 'none';
  if (imported.legacyBaseline) {
    if (!local.legacyBaseline) {
      legacyBaseline = imported.legacyBaseline;
      baseline = 'adopted';
    } else if (sameJson(local.legacyBaseline, imported.legacyBaseline)) {
      baseline = 'identical';
    } else {
      baseline = 'conflict';
    }
  }

  const combined = [...byTimestamp.values()].sort(
    (a, b) => Date.parse(b.endedAt) - Date.parse(a.endedAt) || b.endedAt.localeCompare(a.endedAt),
  );
  const kept = combined.slice(0, SESSION_LEDGER_LIMIT);
  const keptTimestamps = new Set(kept.map((entry) => entry.endedAt));
  return {
    envelope: {
      version: SESSION_LEDGER_VERSION,
      sessions: kept,
      ...(legacyBaseline ? { legacyBaseline } : {}),
    },
    imported: added.filter((entry) => keptTimestamps.has(entry.endedAt)).length,
    duplicates,
    conflicts,
    capDiscarded: Math.max(0, combined.length - SESSION_LEDGER_LIMIT),
    baseline,
  };
};

export const migrateLegacyStats = (legacy: unknown): SessionLedgerEnvelope | null => {
  const legacyBaseline = parseLegacyBaseline(legacy);
  return legacyBaseline ? { version: SESSION_LEDGER_VERSION, sessions: [], legacyBaseline } : null;
};

const previousUtcDate = (dateKey: string): string =>
  utcDateKey(Date.parse(`${dateKey}T00:00:00.000Z`) - 86_400_000);

export const aggregateSessionStats = (
  envelope: SessionLedgerEnvelope,
  now: Date = new Date(),
): SessionStats => {
  const today = utcDateKey(now);
  const todaySessions = envelope.sessions.filter((entry) => utcDateKey(entry.endedAt) === today);
  const baseline = envelope.legacyBaseline;
  const baselineIsToday = baseline?.lastPracticeDate === today;
  const todayDurationSec = todaySessions.reduce((sum, entry) => sum + entry.durationSec, 0);
  const todayBreaths = todaySessions.reduce((sum, entry) => sum + entry.breaths, 0);

  let currentStreak = baseline?.currentStreak ?? 0;
  let lastPracticeDate = baseline?.lastPracticeDate ?? today;
  const practiceDates = [...new Set(envelope.sessions.map((entry) => utcDateKey(entry.endedAt)))]
    .sort();
  for (const date of practiceDates) {
    if (baseline && date <= baseline.lastPracticeDate) continue;
    if (date === lastPracticeDate) continue;
    currentStreak = lastPracticeDate === previousUtcDate(date) ? currentStreak + 1 : 1;
    lastPracticeDate = date;
  }

  return {
    todayMinutes: (baselineIsToday ? baseline.todayMinutes : 0) + Math.floor(todayDurationSec / 60),
    todayBreaths: (baselineIsToday ? baseline.todayBreaths : 0) + todayBreaths,
    currentStreak,
    lastPracticeDate,
  };
};

export const getRollingDailyTrends = (
  envelope: SessionLedgerEnvelope,
  days = 28,
  now: Date = new Date(),
): DailyTrend[] => {
  const end = Date.parse(`${utcDateKey(now)}T00:00:00.000Z`);
  const totals = new Map<string, number>();
  for (const entry of envelope.sessions) {
    const key = utcDateKey(entry.endedAt);
    totals.set(key, (totals.get(key) ?? 0) + entry.durationSec);
  }
  return Array.from({ length: days }, (_, index) => {
    const date = utcDateKey(end - (days - 1 - index) * 86_400_000);
    const durationSec = totals.get(date) ?? 0;
    return { date, durationSec, minutes: Math.floor(durationSec / 60) };
  });
};

export const getTechniqueTotals = (envelope: SessionLedgerEnvelope): TechniqueTotal[] => {
  const totals = new Map<string, Omit<TechniqueTotal, 'techniqueId' | 'minutes'>>();
  for (const entry of envelope.sessions) {
    const current = totals.get(entry.techniqueId) ?? { durationSec: 0, breaths: 0 };
    current.durationSec += entry.durationSec;
    current.breaths += entry.breaths;
    totals.set(entry.techniqueId, current);
  }
  return [...totals.entries()]
    .map(([techniqueId, total]) => ({ techniqueId, ...total, minutes: Math.floor(total.durationSec / 60) }))
    .sort((a, b) => b.durationSec - a.durationSec || a.techniqueId.localeCompare(b.techniqueId));
};
