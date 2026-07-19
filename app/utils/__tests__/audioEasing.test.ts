import { describe, it, expect } from 'vitest';
import { getAudioBreathExpand, getThemeBaseFrequency } from '../audioEasing';

describe('getAudioBreathExpand', () => {
  it('returns 0 at the start of inhale', () => {
    expect(getAudioBreathExpand('inhale', 0, 0)).toBe(0);
  });

  it('returns 1 at the end of inhale', () => {
    expect(getAudioBreathExpand('inhale', 1, 0)).toBeCloseTo(1, 5);
  });

  it('uses cubic-sqrt blend on inhale (not linear)', () => {
    const mid = getAudioBreathExpand('inhale', 0.5, 0);
    expect(mid).toBeGreaterThan(0.4);
    expect(mid).toBeLessThan(0.6);
  });

  it('hold1 shimmers near full expansion', () => {
    const atZero = getAudioBreathExpand('hold1', 0, 0);
    const atPeak = getAudioBreathExpand('hold1', 0, Math.PI / 1.8);
    expect(atZero).toBeCloseTo(0.985, 2);
    expect(atPeak).toBeCloseTo(1, 2);
  });

  it('exhale falls off with power curve', () => {
    expect(getAudioBreathExpand('exhale', 0, 0)).toBe(1);
    expect(getAudioBreathExpand('exhale', 1, 0)).toBe(0);
    const mid = getAudioBreathExpand('exhale', 0.5, 0);
    expect(mid).toBeCloseTo(Math.pow(0.5, 1.35), 5);
  });

  it('hold2 rests with faint ambient oscillation', () => {
    expect(getAudioBreathExpand('hold2', 0, 0)).toBeCloseTo(0.04, 5);
    expect(getAudioBreathExpand('hold2', 0, (3 * Math.PI) / 1.2)).toBeCloseTo(0, 5);
  });
});

describe('getThemeBaseFrequency', () => {
  it('maps known themes to solfeggio fundamentals', () => {
    expect(getThemeBaseFrequency(0)).toBe(432);
    expect(getThemeBaseFrequency(1)).toBe(528);
    expect(getThemeBaseFrequency(2)).toBe(396);
  });

  it('falls back to cosmic frequency for unknown themes', () => {
    expect(getThemeBaseFrequency(99)).toBe(432);
  });
});
