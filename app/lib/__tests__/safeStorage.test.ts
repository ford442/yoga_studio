import { describe, expect, it } from 'vitest';
import { isQuotaExceededError, safeGetItem, safeRemoveItem, safeSetItem } from '../safeStorage';

describe('safeStorage', () => {
  it('round-trips values and never throws on remove of missing keys', () => {
    localStorage.clear();
    expect(safeGetItem('missing')).toBeNull();
    expect(safeSetItem('k', 'v')).toBe(true);
    expect(safeGetItem('k')).toBe('v');
    safeRemoveItem('k');
    expect(safeGetItem('k')).toBeNull();
    safeRemoveItem('k');
  });

  it('detects quota exceeded errors', () => {
    expect(isQuotaExceededError(new DOMException('quota', 'QuotaExceededError'))).toBe(true);
    expect(isQuotaExceededError(new Error('nope'))).toBe(false);
  });
});
