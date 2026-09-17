/**
 * Monotonic clock shared by the breath timer and the render backends.
 * `performance.now()` is immune to system-clock adjustments, which
 * `Date.now()` is not; both are faked together by the test clocks.
 */
export const monotonicNow = (): number =>
  typeof performance !== 'undefined' && typeof performance.now === 'function'
    ? performance.now()
    : Date.now();
