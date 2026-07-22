import { describe, it, expect } from 'vitest';
import { computeIntensity, computePhaseTiming } from '../deriveSessionPhase';
import type { BreathSettings } from '../../../hooks/useBreathTimer';

const settings: BreathSettings = { inhale: 4, hold1: 4, exhale: 6, hold2: 2 };

describe('computePhaseTiming', () => {
  it('reports full remaining time and zero progress at the start of inhale', () => {
    const { remaining, phaseProgress, phaseDuration, totalCycle } = computePhaseTiming(0, 'inhale', settings);
    expect(totalCycle).toBe(16);
    expect(phaseDuration).toBe(4);
    expect(remaining).toBe(4);
    expect(phaseProgress).toBe(0);
  });

  it('computes progress partway through hold1', () => {
    // inhale (4/16) + half of hold1 (2/16) = 6/16 of the cycle
    const breathPhase = 6 / 16;
    const { remaining, phaseProgress, phaseDuration } = computePhaseTiming(breathPhase, 'hold1', settings);
    expect(phaseDuration).toBe(4);
    expect(remaining).toBeCloseTo(2, 5);
    expect(phaseProgress).toBeCloseTo(0.5, 5);
  });

  it('computes progress near the end of exhale', () => {
    // inhale (4) + hold1 (4) + exhale nearly complete (5.9/6) = 13.9/16
    const breathPhase = 13.9 / 16;
    const { remaining, phaseProgress } = computePhaseTiming(breathPhase, 'exhale', settings);
    expect(remaining).toBeCloseTo(0.1, 5);
    expect(phaseProgress).toBeCloseTo(0.9833, 3);
  });

  it('handles a zero-length hold2 without dividing by zero', () => {
    const zeroHold: BreathSettings = { inhale: 4, hold1: 4, exhale: 6, hold2: 0 };
    const { phaseProgress, phaseDuration } = computePhaseTiming(1, 'hold2', zeroHold);
    expect(phaseDuration).toBe(0);
    expect(phaseProgress).toBe(0);
  });
});

describe('computeIntensity', () => {
  it('rises with progress during inhale', () => {
    expect(computeIntensity('inhale', 0)).toBe(0);
    expect(computeIntensity('inhale', 0.5)).toBe(0.5);
    expect(computeIntensity('inhale', 1)).toBe(1);
  });

  it('holds at full intensity during hold1 regardless of progress', () => {
    expect(computeIntensity('hold1', 0)).toBe(1.0);
    expect(computeIntensity('hold1', 0.9)).toBe(1.0);
  });

  it('falls with progress during exhale', () => {
    expect(computeIntensity('exhale', 0)).toBe(1);
    expect(computeIntensity('exhale', 0.5)).toBe(0.5);
    expect(computeIntensity('exhale', 1)).toBe(0);
  });

  it('rests at a gentle level during hold2 regardless of progress', () => {
    expect(computeIntensity('hold2', 0)).toBe(0.3);
    expect(computeIntensity('hold2', 1)).toBe(0.3);
  });
});
