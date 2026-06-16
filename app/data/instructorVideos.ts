import type { BreathPhase } from '../hooks/useBreathTimer';

export interface InstructorClip {
  src: string;
  label: string;
}

/**
 * A single phase performance. Clips are authored as FULL-PHASE performances:
 * the movement runs from progress 0 (first frame) to 1 (last frame), so the
 * runtime locks them to the breath countdown via playbackRate + proportional
 * seek. `duration` is the intrinsic authored length (seconds).
 */
export interface InstructorPhaseClip {
  /** mp4 (h264) — universal fallback. Also used for the availability probe. */
  src: string;
  /** webm (vp9) — preferred where supported. */
  webm?: string;
  /** Intrinsic authored duration in seconds. */
  duration: number;
  label: string;
}

export type InstructorPhaseClips = Record<BreathPhase, InstructorPhaseClip>;

export interface InstructorStyle {
  id: string;
  label: string;
  clips: InstructorPhaseClips;
}

const clip = (
  base: string,
  duration: number,
  label: string,
): InstructorPhaseClip => ({
  src: `instructor/${base}.mp4`,
  webm: `instructor/${base}.webm`,
  duration,
  label,
});

/**
 * Default "serene" instructor: a silhouette that raises on the inhale, holds
 * overhead, lowers on the exhale, and rests still. Most modes share it; add new
 * entries here and map them in STYLE_BY_POSE for style-specific instructors.
 */
const SERENE: InstructorStyle = {
  id: 'serene',
  label: 'Serene guide',
  clips: {
    inhale: clip('inhale-raise-01', 4.0, 'Inhale · arms rise'),
    hold1: clip('hold1-arms-high-01', 3.0, 'Hold · arms high'),
    exhale: clip('exhale-lower-01', 4.0, 'Exhale · arms lower'),
    hold2: clip('hold2-still-01', 3.0, 'Hold · stillness'),
  },
};

export const INSTRUCTOR_STYLES: Record<string, InstructorStyle> = {
  serene: SERENE,
};

export const DEFAULT_INSTRUCTOR_STYLE = SERENE;

/**
 * Map a shader figurePose to an instructor style. All poses currently share the
 * serene guide; advanced modes can point at bespoke styles here without any
 * change to the playback engine.
 */
const STYLE_BY_POSE: Partial<Record<number, string>> = {
  // 0: 'lotus-master', 5: 'warrior', ...  (future style-specific instructors)
};

export function getInstructorStyleForPose(figurePose: number): InstructorStyle {
  const id = STYLE_BY_POSE[figurePose];
  return (id && INSTRUCTOR_STYLES[id]) || DEFAULT_INSTRUCTOR_STYLE;
}

export function getPhaseClip(
  style: InstructorStyle,
  phase: BreathPhase,
): InstructorPhaseClip {
  return style.clips[phase];
}

// ---- Back-compat: pose-indexed single clip + availability probe ------------
export function getInstructorClipForPose(figurePose: number): InstructorClip {
  const c = getInstructorStyleForPose(figurePose).clips.inhale;
  return { src: c.src, label: c.label };
}

/** Clip used to probe whether instructor assets are available on this deployment. */
export const INSTRUCTOR_PROBE_CLIP = SERENE.clips.inhale.src;
