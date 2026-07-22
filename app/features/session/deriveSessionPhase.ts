import type { BreathPhase, BreathSettings } from '../../hooks/useBreathTimer';

export interface PhaseTiming {
  totalCycle: number;
  phaseProgress: number;
  remaining: number;
  phaseDuration: number;
}

/** Derives remaining seconds and 0..1 progress within the current phase from the raw 0..1 cycle position. */
export function computePhaseTiming(
  breathPhase: number,
  currentPhase: BreathPhase,
  settings: BreathSettings,
): PhaseTiming {
  const totalCycle = settings.inhale + settings.hold1 + settings.exhale + settings.hold2;
  const elapsedInCycle = (breathPhase * totalCycle) % totalCycle;

  let remaining = 0;
  if (currentPhase === 'inhale') remaining = settings.inhale - elapsedInCycle;
  else if (currentPhase === 'hold1') remaining = settings.hold1 - (elapsedInCycle - settings.inhale);
  else if (currentPhase === 'exhale') remaining = settings.exhale - (elapsedInCycle - settings.inhale - settings.hold1);
  else remaining = settings.hold2 - (elapsedInCycle - settings.inhale - settings.hold1 - settings.exhale);

  const phaseDuration =
    currentPhase === 'inhale' ? settings.inhale :
    currentPhase === 'hold1' ? settings.hold1 :
    currentPhase === 'exhale' ? settings.exhale :
    settings.hold2;
  const phaseElapsed = phaseDuration > 0
    ? Math.max(0, phaseDuration - Math.max(0, remaining))
    : 0;
  const phaseProgress = phaseDuration > 0
    ? Math.min(1, phaseElapsed / phaseDuration)
    : 0;

  return { totalCycle, phaseProgress, remaining, phaseDuration };
}

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
