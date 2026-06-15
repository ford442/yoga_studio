'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { getInstructorClipForPose } from '../data/instructorVideos';
import { resolveAssetUrl } from '../lib/resolveAssetUrl';
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
  onDragOffset,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const dragOriginRef = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);
  const [activeSrc, setActiveSrc] = useState(() => getInstructorClipForPose(figurePose).src);
  const [incomingSrc, setIncomingSrc] = useState<string | null>(null);
  const [loadError, setLoadError] = useState(false);

  const clip = getInstructorClipForPose(figurePose);
  const effectiveMuted = !audioEnabled || voiceGuidanceEnabled;

  useEffect(() => {
    if (clip.src === activeSrc) return;
    setIncomingSrc(clip.src);
  }, [clip.src, activeSrc]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !enabled) return;

    if (isRunning) {
      void video.play().catch(() => {
        /* autoplay policy — user gesture will resume */
      });
    } else {
      video.pause();
    }
  }, [enabled, isRunning, activeSrc]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = effectiveMuted;
    if (!effectiveMuted) {
      video.volume = 0.55;
    }
  }, [effectiveMuted, activeSrc]);

  const handleLoadedData = useCallback(() => {
    setLoadError(false);
    if (incomingSrc) {
      setActiveSrc(incomingSrc);
      setIncomingSrc(null);
    }
  }, [incomingSrc]);

  const handleError = useCallback(() => {
    setLoadError(true);
  }, []);

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

  const src = incomingSrc ?? activeSrc;
  const videoElement = (
    <video
      ref={videoRef}
      key={src}
      src={resolveAssetUrl(src)}
      className="h-full w-full object-cover"
      playsInline
      muted
      loop
      preload="metadata"
      disablePictureInPicture
      onLoadedData={handleLoadedData}
      onError={handleError}
    />
  );

  if (layout === 'underlay') {
    return (
      <div
        className="pointer-events-none absolute inset-0 z-[1] overflow-hidden"
        aria-hidden
      >
        <div className="absolute inset-0 scale-105 blur-md opacity-[0.22] saturate-75">
          {videoElement}
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
      style={{
        transform: `translate(${pipDragOffset.x}px, ${pipDragOffset.y}px)`,
      }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      <div className="aspect-[3/4] overflow-hidden rounded-2xl border border-white/25 bg-black/40 shadow-lg shadow-black/50 backdrop-blur-sm">
        {videoElement}
      </div>
      <p className="mt-1 text-center text-[8px] tracking-widest text-white/50 pointer-events-none">
        GUIDE
      </p>
    </div>
  );
};

export default InstructorVideoGuide;
