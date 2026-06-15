export interface InstructorClip {
  src: string;
  label: string;
}

/** Pose-indexed clips; falls back to generic when a pose clip is missing. */
export const INSTRUCTOR_CLIPS_BY_POSE: Partial<Record<number, InstructorClip>> = {
  0: { src: 'instructor/lotus-breath.mp4', label: 'Lotus breath' },
  1: { src: 'instructor/tadasana-breath.mp4', label: 'Mountain breath' },
};

export const GENERIC_INSTRUCTOR_CLIP: InstructorClip = {
  src: 'instructor/generic-breath.mp4',
  label: 'Breath guide',
};

export function getInstructorClipForPose(figurePose: number): InstructorClip {
  return INSTRUCTOR_CLIPS_BY_POSE[figurePose] ?? GENERIC_INSTRUCTOR_CLIP;
}

/** Clip used to probe whether instructor assets are available on this deployment. */
export const INSTRUCTOR_PROBE_CLIP = GENERIC_INSTRUCTOR_CLIP.src;
