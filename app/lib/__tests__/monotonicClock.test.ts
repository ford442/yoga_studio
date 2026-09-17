import { afterEach, describe, expect, it, vi } from 'vitest';
import { monotonicNow } from '../monotonicClock';

describe('monotonicNow', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('reads performance.now, not the wall clock', () => {
    const perf = vi.spyOn(performance, 'now').mockReturnValue(1234.5);
    const wall = vi.spyOn(Date, 'now').mockReturnValue(1_700_000_000_000);
    expect(monotonicNow()).toBe(1234.5);
    expect(perf).toHaveBeenCalled();
    expect(wall).not.toHaveBeenCalled();
  });

  it('never goes backwards when the system clock is set back', () => {
    let t = 100;
    vi.spyOn(performance, 'now').mockImplementation(() => (t += 16));
    const first = monotonicNow();
    // A user (or NTP) moving the clock back an hour must not rewind the shader.
    vi.spyOn(Date, 'now').mockReturnValue(0);
    expect(monotonicNow()).toBeGreaterThan(first);
  });

  it('falls back to Date.now where performance is unavailable', () => {
    const original = globalThis.performance;
    vi.spyOn(Date, 'now').mockReturnValue(42);
    try {
      Reflect.deleteProperty(globalThis, 'performance');
      expect(monotonicNow()).toBe(42);
    } finally {
      Object.defineProperty(globalThis, 'performance', { value: original, configurable: true });
    }
  });
});
