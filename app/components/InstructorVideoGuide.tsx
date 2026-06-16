'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  getInstructorStyleForPose,
  getPhaseClip,
  type InstructorPhaseClip,
} from '../data/instructorVideos';
import { resolveAssetUrl } from '../lib/resolveAssetUrl';
import type { BreathPhase } from '../hooks/useBreathTimer';
import type {
  InstructorLayout,
  InstructorPipCorner,
  InstructorPipSize,
} from '../types/instructorVideo';

interface InstructorVideoGuideProps {
  enabled: boolean;
  layout: InstructorLayout;
  pipSize: InstructorPipSize;
  pipCorner: InstructorPipCorner;
  pipDragOffset: { x: number; y: number };
  audioEnabled: boolean;
  /** When voice guidance is on, instructor audio is suppressed to avoid overlap */
  voiceGuidanceEnabled: boolean;
  figurePose: number;
  isRunning: boolean;
  /** Current breath phase from useBreathTimer */
  currentPhase: BreathPhase;
  /** 0→1 progress through the current phase (from page.tsx) */
  phaseProgress: number;
  /** Live duration of the current phase in seconds (0 when phase is skipped) */
  phaseDurationSec: number;
  /** 0→1 breath energy; gently brightens the figure */
  intensity: number;
  onDragOffset: (offset: { x: number; y: number }) => void;
}

const PIP_WIDTH: Record<InstructorPipSize, string> = {
  sm: 'w-[88px]',
  md: 'w-[120px]',
  lg: 'w-[152px]',
};

const CORNER_POSITION: Record<InstructorPipCorner, string> = {
  'top-left':
    'top-[max(5.5rem,calc(env(safe-area-inset-top)+4.5rem))] left-[max(1rem,env(safe-area-inset-left))]',
  'top-right':
    'top-[max(5.5rem,calc(env(safe-area-inset-top)+4.5rem))] right-[max(1rem,env(safe-area-inset-right))]',
  'bottom-left':
    'bottom-[max(11rem,calc(env(safe-area-inset-bottom)+10rem))] left-[max(1rem,env(safe-area-inset-left))]',
  'bottom-right':
    'bottom-[max(11rem,calc(env(safe-area-inset-bottom)+10rem))] right-[max(1rem,env(safe-area-inset-right))]',
};

// Movement leads the numeric countdown by this much so it feels human-anticipatory.
const ANTICIPATION_LEAD_SEC = 0.2;
// Lockstep is held with a velocity control loop: rate = idealRate + GAIN*drift.
// This keeps the clip moving smoothly forward (no backward stutter) while
// converging on the countdown, even when the phase is much longer than the clip
// (e.g. a 10s inhale over a 4s clip → ~0.4x slow-fill, which is exactly right).
const RATE_GAIN = 4;
// Soft rate envelope: low enough to slow-fill a long phase, capped so a short
// phase over a long clip never looks comically fast.
const RATE_MIN = 0.1;
const RATE_MAX = 3.0;
// Only hard-seek to recover from a real stall (tab backgrounded, buffering).
const HARD_SNAP_SEC = 0.5;
const CROSSFADE_MS = 320;

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

interface Slot {
  clip: InstructorPhaseClip;
  id: number;
}

interface SyncState {
  isRunning: boolean;
  phaseProgress: number;
  phaseDurationSec: number;
}

const InstructorVideoGuide: React.FC<InstructorVideoGuideProps> = ({
  enabled,
  layout,
  pipSize,
  pipCorner,
  pipDragOffset,
  audioEnabled,
  voiceGuidanceEnabled,
  figurePose,
  isRunning,
  currentPhase,
  phaseProgress,
  phaseDurationSec,
  intensity,
  onDragOffset,
}) => {
  const style = getInstructorStyleForPose(figurePose);
  const styleId = style.id;
  const effectiveMuted = !audioEnabled || voiceGuidanceEnabled;

  // Two stacked clips: `front` (newest, fading in) over `back` (previous, fading out).
  const [front, setFront] = useState<Slot>(() => ({
    clip: getPhaseClip(style, currentPhase),
    id: 0,
  }));
  const [back, setBack] = useState<Slot | null>(null);
  const [loadError, setLoadError] = useState(false);

  const dragOriginRef = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);

  // Imperative handles for the rAF sync loop (front video remounts each phase).
  const frontElRef = useRef<HTMLVideoElement | null>(null);
  const frontClipRef = useRef<InstructorPhaseClip>(front.clip);
  const syncRef = useRef<SyncState>({ isRunning, phaseProgress, phaseDurationSec });
  const mutedRef = useRef(effectiveMuted);
  const lastPhaseKeyRef = useRef(`${styleId}:${currentPhase}`);
  const fadeTimerRef = useRef<number | null>(null);

  useEffect(() => {
    syncRef.current = { isRunning, phaseProgress, phaseDurationSec };
  }, [isRunning, phaseProgress, phaseDurationSec]);

  useEffect(() => {
    mutedRef.current = effectiveMuted;
    const v = frontElRef.current;
    if (v) {
      v.muted = effectiveMuted;
      if (!effectiveMuted) v.volume = 0.55;
    }
  }, [effectiveMuted]);

  // Phase / style change → cross-fade a fresh clip into the front layer.
  useEffect(() => {
    if (!enabled) return;
    const key = `${styleId}:${currentPhase}`;
    if (key === lastPhaseKeyRef.current) return;
    lastPhaseKeyRef.current = key;

    const next = getPhaseClip(style, currentPhase);
    frontClipRef.current = next;

    setFront((prev) => {
      // Only the previous clip needs to linger for the fade; if the same file is
      // reused across phases the rAF loop just re-seeks it (no remount).
      if (prev.clip.src !== next.src) {
        setBack({ clip: prev.clip, id: prev.id });
        if (fadeTimerRef.current) window.clearTimeout(fadeTimerRef.current);
        fadeTimerRef.current = window.setTimeout(() => setBack(null), CROSSFADE_MS);
      }
      return { clip: next, id: prev.id + 1 };
    });
  }, [enabled, styleId, currentPhase, style]);

  // Single rAF loop drives the front clip into lockstep with the countdown.
  useEffect(() => {
    if (!enabled) return;
    let raf = 0;
    const tick = () => {
      const v = frontElRef.current;
      const clip = frontClipRef.current;
      const st = syncRef.current;
      if (v && clip && v.readyState >= 1) {
        const synced = st.isRunning && st.phaseDurationSec > 0.05;
        if (synced) {
          v.loop = false;
          // Anticipation: target a moment slightly ahead of the countdown so the
          // movement leads the numbers by ~200ms (feels human).
          const lead = ANTICIPATION_LEAD_SEC / st.phaseDurationSec;
          const tp = clamp(st.phaseProgress + lead, 0, 1);
          const target = tp * clip.duration;
          if (v.readyState >= 2) {
            const drift = target - v.currentTime;
            if (Math.abs(drift) > HARD_SNAP_SEC) {
              // Big gap (stall/resume) — snap to recover, then resume tracking.
              try { v.currentTime = target; } catch { /* seeking guard */ }
            } else {
              const idealRate = clip.duration / st.phaseDurationSec;
              const rate = clamp(idealRate + RATE_GAIN * drift, RATE_MIN, RATE_MAX);
              if (Math.abs(v.playbackRate - rate) > 0.02) v.playbackRate = rate;
            }
            if (v.paused) v.play().catch(() => {});
          }
        } else {
          // Paused or free-form without an active phase: gentle ambient loop.
          v.loop = true;
          if (Math.abs(v.playbackRate - 1) > 0.01) v.playbackRate = 1;
          if (v.paused) v.play().catch(() => {});
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [enabled]);

  useEffect(
    () => () => {
      if (fadeTimerRef.current) window.clearTimeout(fadeTimerRef.current);
    },
    [],
  );

  const setFrontEl = useCallback((el: HTMLVideoElement | null) => {
    frontElRef.current = el;
    if (el) {
      el.muted = mutedRef.current;
      if (!mutedRef.current) el.volume = 0.55;
      // Seek straight to the live position so a fresh phase clip never flashes
      // its first frame before the rAF catches up.
      const st = syncRef.current;
      if (st.isRunning && st.phaseDurationSec > 0.05) {
        const tp = clamp(st.phaseProgress + ANTICIPATION_LEAD_SEC / st.phaseDurationSec, 0, 1);
        try { el.currentTime = tp * frontClipRef.current.duration; } catch { /* not ready */ }
      }
      el.play().catch(() => {});
    }
  }, []);

  const handleError = useCallback(() => setLoadError(true), []);

  const onPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (layout !== 'pip') return;
      e.currentTarget.setPointerCapture(e.pointerId);
      dragOriginRef.current = {
        x: e.clientX,
        y: e.clientY,
        ox: pipDragOffset.x,
        oy: pipDragOffset.y,
      };
    },
    [layout, pipDragOffset.x, pipDragOffset.y],
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const origin = dragOriginRef.current;
      if (!origin) return;
      onDragOffset({
        x: origin.ox + (e.clientX - origin.x),
        y: origin.oy + (e.clientY - origin.y),
      });
    },
    [onDragOffset],
  );

  const onPointerUp = useCallback(() => {
    dragOriginRef.current = null;
  }, []);

  if (!enabled || loadError) return null;

  const videoClass =
    'absolute inset-0 h-full w-full object-cover select-none pointer-events-none';

  const renderVideo = (slot: Slot, isFront: boolean) => (
    <video
      key={slot.id}
      ref={isFront ? setFrontEl : undefined}
      className={`${videoClass} ${isFront ? 'instructor-fade-in' : ''}`}
      playsInline
      muted
      preload="auto"
      disablePictureInPicture
      onError={isFront ? handleError : undefined}
    >
      {slot.clip.webm && <source src={resolveAssetUrl(slot.clip.webm)} type="video/webm" />}
      <source src={resolveAssetUrl(slot.clip.src)} type="video/mp4" />
    </video>
  );

  // Breath energy gently brightens the figure (kept subtle to avoid flicker).
  const stack = (
    <div
      className="absolute inset-0"
      style={{ filter: `brightness(${(0.9 + 0.18 * clamp(intensity, 0, 1)).toFixed(3)})` }}
    >
      {back && renderVideo(back, false)}
      {renderVideo(front, true)}
    </div>
  );

  if (layout === 'underlay') {
    return (
      <div className="pointer-events-none absolute inset-0 z-[1] overflow-hidden" aria-hidden>
        <div className="absolute inset-0 scale-105 blur-md opacity-[0.22] saturate-75">
          {stack}
        </div>
        <div
          className="absolute inset-0"
          style={{
            background:
              'radial-gradient(ellipse at center, rgba(5,1,10,0.25) 0%, rgba(5,1,10,0.72) 100%)',
          }}
        />
      </div>
    );
  }

  return (
    <div
      className={`fixed z-[12] touch-none select-none ${CORNER_POSITION[pipCorner]} ${PIP_WIDTH[pipSize]}`}
      style={{ transform: `translate(${pipDragOffset.x}px, ${pipDragOffset.y}px)` }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      <div className="relative aspect-[3/4] overflow-hidden rounded-2xl border border-white/25 bg-black/40 shadow-lg shadow-black/50 backdrop-blur-sm">
        {stack}
      </div>
      <p className="mt-1 text-center text-[8px] tracking-widest text-white/50 pointer-events-none">
        GUIDE
      </p>
    </div>
  );
};

export default InstructorVideoGuide;
