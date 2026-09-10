import type { BreathPhase } from '../../hooks/useBreathTimer';

/**
 * Phase-aware intensity: rises 0→1 on inhale, holds at ~1, falls 1→0 on
 * exhale, rests at a gentle level during hold2. Drives lotus bloom, ribbon
 * brightness, and aura brightness in the shader.
 */
export function computeIntensity(currentPhase: BreathPhase, phaseProgress: number): number {
  return currentPhase === 'inhale' ? phaseProgress :
    currentPhase === 'hold1' ? 1.0 :
    currentPhase === 'exhale' ? 1.0 - phaseProgress :
    0.3;
}
