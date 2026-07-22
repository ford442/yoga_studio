import { renderHook, waitFor, act } from '@testing-library/react';
import { describe, it, expect, beforeEach } from 'vitest';
import { useLastSession } from '../useLastSession';

const STORAGE_KEY = 'sacred-breath-last-session';

describe('useLastSession', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('returns null when localStorage is empty', () => {
    const { result } = renderHook(() => useLastSession());
    expect(result.current.lastSession).toBeNull();
  });

  it('hydrates a valid stored session on mount', async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ modeId: 'lotus-heart', duration: 10 }));
    const { result } = renderHook(() => useLastSession());
    await waitFor(() =>
      expect(result.current.lastSession).toEqual({ modeId: 'lotus-heart', duration: 10 }),
    );
  });

  it('ignores an invalid stored payload', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ modeId: 'lotus-heart', duration: 7 }));
    const { result } = renderHook(() => useLastSession());
    expect(result.current.lastSession).toBeNull();
  });

  it('ignores malformed JSON', () => {
    localStorage.setItem(STORAGE_KEY, 'not json');
    const { result } = renderHook(() => useLastSession());
    expect(result.current.lastSession).toBeNull();
  });

  it('persistLastSession updates state and localStorage', () => {
    const { result } = renderHook(() => useLastSession());

    act(() => {
      result.current.persistLastSession('nadi-shodhana', 'free');
    });

    expect(result.current.lastSession).toEqual({ modeId: 'nadi-shodhana', duration: 'free' });
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!)).toEqual({
      modeId: 'nadi-shodhana',
      duration: 'free',
    });
  });
});
