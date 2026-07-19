import type { BreathPhase } from '../hooks/useBreathTimer';

/**
 * Replicates the shader's asymmetric biological lung expansion curves
 * (`deriveBreathExpand` in sacred-lotus-final.wgsl) for exact mathematical
 * sync between WebGPU visuals and Web Audio API nodes.
 */
export function getAudioBreathExpand(
  phase: BreathPhase,
  progress: number,
  time: number,
): number {
  const pp = Math.min(Math.max(progress, 0), 1);

  switch (phase) {
    case 'inhale': {
      const eased = pp * pp * (3 - 2 * pp);
      return eased * 0.65 + Math.sqrt(eased) * 0.35;
    }
    case 'hold1':
      return 1 - 0.015 * (1 - Math.sin(time * 0.9));
    case 'exhale':
      return Math.pow(1 - pp, 1.35);
    case 'hold2':
    default:
      return 0.04 + 0.04 * Math.sin(time * 0.6);
  }
}

/** Solfeggio fundamentals mapped to app theme indices (0=Cosmic, 1=Golden, 2=Ocean). */
export const THEME_BASE_FREQUENCIES: Record<number, number> = {
  0: 432,
  1: 528,
  2: 396,
};

export function getThemeBaseFrequency(themeIndex: number): number {
  return THEME_BASE_FREQUENCIES[themeIndex] ?? THEME_BASE_FREQUENCIES[0];
}
