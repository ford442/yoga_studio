'use client';

import { useCallback, useEffect, useState } from 'react';
import { INSTRUCTOR_PROBE_CLIP } from '../data/instructorVideos';
import { resolveAssetUrl } from '../lib/resolveAssetUrl';
import {
  DEFAULT_INSTRUCTOR_SETTINGS,
  type InstructorPipCorner,
  type InstructorPipSize,
  type InstructorLayout,
  type InstructorVideoSettings,
} from '../types/instructorVideo';

const STORAGE_KEY = 'sacred-breath-instructor';

const isLayout = (v: unknown): v is InstructorLayout => v === 'pip' || v === 'underlay';
const isPipSize = (v: unknown): v is InstructorPipSize =>
  v === 'sm' || v === 'md' || v === 'lg';
const isPipCorner = (v: unknown): v is InstructorPipCorner =>
  v === 'top-left' || v === 'top-right' || v === 'bottom-left' || v === 'bottom-right';

const parseSettings = (raw: unknown): InstructorVideoSettings => {
  if (!raw || typeof raw !== 'object') return DEFAULT_INSTRUCTOR_SETTINGS;
  const data = raw as Partial<InstructorVideoSettings>;
  const offset = data.pipDragOffset;
  return {
    enabled: Boolean(data.enabled),
    layout: isLayout(data.layout) ? data.layout : DEFAULT_INSTRUCTOR_SETTINGS.layout,
    pipSize: isPipSize(data.pipSize) ? data.pipSize : DEFAULT_INSTRUCTOR_SETTINGS.pipSize,
    pipCorner: isPipCorner(data.pipCorner) ? data.pipCorner : DEFAULT_INSTRUCTOR_SETTINGS.pipCorner,
    pipDragOffset:
      offset && typeof offset.x === 'number' && typeof offset.y === 'number'
        ? { x: offset.x, y: offset.y }
        : DEFAULT_INSTRUCTOR_SETTINGS.pipDragOffset,
    audioEnabled: Boolean(data.audioEnabled),
  };
};

const readStoredSettings = (): InstructorVideoSettings => {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return DEFAULT_INSTRUCTOR_SETTINGS;
  try {
    return parseSettings(JSON.parse(raw));
  } catch {
    console.warn('Invalid sacred-breath-instructor localStorage payload');
    return DEFAULT_INSTRUCTOR_SETTINGS;
  }
};

const canPlayVideo = (): boolean => {
  if (typeof document === 'undefined') return false;
  const video = document.createElement('video');
  return Boolean(video.canPlayType('video/mp4; codecs="avc1.42E01E"') || video.canPlayType('video/webm'));
};

export function useInstructorVideo() {
  const [settings, setSettingsState] = useState<InstructorVideoSettings>(DEFAULT_INSTRUCTOR_SETTINGS);
  const [isSupported, setIsSupported] = useState(false);
  const [isAvailable, setIsAvailable] = useState(false);
  const [availabilityChecked, setAvailabilityChecked] = useState(false);

  useEffect(() => {
    setSettingsState(readStoredSettings());
    setIsSupported(canPlayVideo());
  }, []);

  useEffect(() => {
    if (!isSupported) {
      setAvailabilityChecked(true);
      return;
    }

    let cancelled = false;
    const probe = async () => {
      try {
        const response = await fetch(resolveAssetUrl(INSTRUCTOR_PROBE_CLIP), { method: 'HEAD' });
        if (!cancelled) {
          setIsAvailable(response.ok);
          setAvailabilityChecked(true);
        }
      } catch {
        if (!cancelled) {
          // Optimistic: some static hosts reject HEAD; video onError will hide if missing.
          setIsAvailable(true);
          setAvailabilityChecked(true);
        }
      }
    };

    void probe();
    return () => {
      cancelled = true;
    };
  }, [isSupported]);

  const updateSettings = useCallback(
    (patch: Partial<InstructorVideoSettings>) => {
      setSettingsState((prev) => {
        const next = { ...prev, ...patch };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        return next;
      });
    },
    [],
  );

  const toggleEnabled = useCallback(() => {
    setSettingsState((prev) => {
      const next = { ...prev, enabled: !prev.enabled };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const canUseInstructor = isSupported && isAvailable;

  return {
    settings,
    isSupported,
    isAvailable,
    availabilityChecked,
    canUseInstructor,
    updateSettings,
    toggleEnabled,
  };
}
