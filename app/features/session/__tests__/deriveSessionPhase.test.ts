import { describe, it, expect } from 'vitest';
import { computeIntensity } from '../deriveSessionPhase';

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
