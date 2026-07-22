import type { BreathPhase } from '../hooks/useBreathTimer';
import clipManifest from './instructorClips.generated.json' with { type: 'json' };

export interface InstructorClip {
  src: string;
  label: string;
}

interface GeneratedClipInfo {
  name: string;
  duration: number;
  width: number;
  height: number;
  hasAudio: boolean;
}

const CLIP_MANIFEST = clipManifest as Record<string, GeneratedClipInfo>;

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
  /** First-frame poster, shown while the video buffers. */
  poster?: string;
  /** Intrinsic authored duration in seconds, sourced from instructorClips.generated.json. */
  duration: number;
  label: string;
}

export type InstructorPhaseClips = Record<BreathPhase, InstructorPhaseClip>;

export interface InstructorStyle {
  id: string;
  label: string;
  clips: InstructorPhaseClips;
}

const clip = (base: string, label: string): InstructorPhaseClip => {
  const info = CLIP_MANIFEST[base];
  if (!info) {
    throw new Error(
      `instructorVideos.ts: clip "${base}" is not in instructorClips.generated.json — ` +
        `run \`npm run media:instructor\` after adding assets/video/${base}.mp4`,
    );
  }
  return {
    src: `instructor/${base}.mp4`,
    webm: `instructor/${base}.webm`,
    poster: `instructor/${base}.webp`,
    duration: info.duration,
    label,
  };
};

/**
 * Default "serene" instructor: filmed guide who raises her arms on the inhale,
 * holds overhead, lowers on the exhale, and rests still. Source mp4s live in
 * assets/video/ and are encoded into public/instructor/ (mp4 + vp9/opus webm +
 * webp poster) by `npm run media:instructor`, which also probes each clip's
 * real duration into instructorClips.generated.json. `still_arms_up` (a wider
 * V-shape hold) is shipped as an alternate for hold1 — swap it in here if the
 * overhead hold reads too tall.
 */
const SERENE: InstructorStyle = {
  id: 'serene',
  label: 'Serene guide',
  clips: {
    inhale: clip('raise_arms', 'Inhale · arms rise'),
    hold1: clip('arms_up', 'Hold · arms high'),
    exhale: clip('lower_arms', 'Exhale · arms lower'),
    hold2: clip('still_arms_down', 'Hold · stillness'),
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
