'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  DEFAULT_RENDERER_SETTINGS,
  RENDERER_STORAGE_KEY,
  type GovernorPersistedTier,
  type PerformanceMode,
  type RendererSettings,
} from '../types/renderer';
import { parseGovernorTier } from '../renderer/frameGovernor';
import { safeGetItem, safeSetItem } from '../lib/safeStorage';

const isPerformanceMode = (v: unknown): v is PerformanceMode =>
  v === 'auto' || v === 'performance' || v === 'quality';

const parseSettings = (raw: unknown): RendererSettings => {
  if (!raw || typeof raw !== 'object') return DEFAULT_RENDERER_SETTINGS;
  const data = raw as Partial<RendererSettings>;
  const parsed = parseGovernorTier(data.governorTier);
  const governorTier: GovernorPersistedTier | undefined =
    parsed &&
    parsed.resolutionScale !== undefined &&
    parsed.qualityPreset !== undefined &&
    parsed.overlayEnabled !== undefined
      ? {
          resolutionScale: parsed.resolutionScale,
          qualityPreset: parsed.qualityPreset,
          overlayEnabled: parsed.overlayEnabled,
        }
      : undefined;
  return {
    performanceMode: isPerformanceMode(data.performanceMode)
      ? data.performanceMode
      : DEFAULT_RENDERER_SETTINGS.performanceMode,
    reducedMotion: Boolean(data.reducedMotion),
    showDiagnostics: Boolean(data.showDiagnostics),
    ...(governorTier ? { governorTier } : {}),
  };
};

const readStoredSettings = (): RendererSettings => {
  if (typeof window === 'undefined') return DEFAULT_RENDERER_SETTINGS;
  const raw = safeGetItem(RENDERER_STORAGE_KEY);
  if (!raw) return DEFAULT_RENDERER_SETTINGS;
  try {
    return parseSettings(JSON.parse(raw));
  } catch {
    console.warn('Invalid sacred-breath-renderer localStorage payload');
    return DEFAULT_RENDERER_SETTINGS;
  }
};

interface BatteryManager {
  save: boolean;
  addEventListener: (type: string, listener: EventListener) => void;
  removeEventListener: (type: string, listener: EventListener) => void;
}

export function useRendererSettings() {
  const [settings, setSettings] = useState<RendererSettings>(DEFAULT_RENDERER_SETTINGS);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const [batterySaver, setBatterySaver] = useState(false);

  // Load persisted settings and system motion preference.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSettings(readStoredSettings());
    setHasLoaded(true);

    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReducedMotion(mq.matches);
    const handleMotionChange = (event: MediaQueryListEvent) => {
      setPrefersReducedMotion(event.matches);
    };
    mq.addEventListener('change', handleMotionChange);
    return () => mq.removeEventListener('change', handleMotionChange);
  }, []);

  // Listen for battery saver state when available.
  useEffect(() => {
    if (typeof navigator === 'undefined' || !('getBattery' in navigator)) return;

    let batteryRef: BatteryManager | null = null;
    let cancelled = false;

    const handleLevelChange = () => {
      if (!cancelled && batteryRef) {
        setBatterySaver(batteryRef.save);
      }
    };

    void (navigator as Navigator & { getBattery?: () => Promise<BatteryManager> })
      .getBattery?.()
      .then((battery) => {
        if (cancelled) return;
        batteryRef = battery;
        setBatterySaver(battery.save);
        battery.addEventListener('levelchange', handleLevelChange);
        battery.addEventListener('chargingchange', handleLevelChange);
      })
      .catch(() => {
        // Battery API unavailable or denied; ignore.
      });

    return () => {
      cancelled = true;
      if (batteryRef) {
        batteryRef.removeEventListener('levelchange', handleLevelChange);
        batteryRef.removeEventListener('chargingchange', handleLevelChange);
      }
    };
  }, []);

  // Persist user-level settings whenever they change (best-effort).
  useEffect(() => {
    if (!hasLoaded || typeof window === 'undefined') return;
    safeSetItem(RENDERER_STORAGE_KEY, JSON.stringify(settings));
  }, [hasLoaded, settings]);

  const updateSettings = useCallback((patch: Partial<RendererSettings>) => {
    setSettings((prev) => ({ ...prev, ...patch }));
  }, []);

  const effectivePerformanceMode: PerformanceMode =
    settings.performanceMode === 'performance' ||
    settings.reducedMotion ||
    prefersReducedMotion ||
    batterySaver
      ? 'performance'
      : settings.performanceMode;

  const isPerformanceForced =
    settings.reducedMotion || prefersReducedMotion || batterySaver;

  return {
    settings,
    updateSettings,
    effectivePerformanceMode,
    isPerformanceForced,
    prefersReducedMotion,
    batterySaver,
  };
}
