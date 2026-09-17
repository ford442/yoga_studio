import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useRendererSettings } from '../useRendererSettings';

interface MockBattery {
  level: number;
  charging: boolean;
  addEventListener: (type: string, listener: EventListener) => void;
  removeEventListener: (type: string, listener: EventListener) => void;
  dispatch: (type: string) => void;
}

function mockBattery(level: number, charging: boolean): MockBattery {
  const listeners = new Map<string, Set<EventListener>>();
  return {
    level,
    charging,
    addEventListener: (type, listener) => {
      if (!listeners.has(type)) listeners.set(type, new Set());
      listeners.get(type)!.add(listener);
    },
    removeEventListener: (type, listener) => {
      listeners.get(type)?.delete(listener);
    },
    dispatch: (type) => {
      for (const listener of listeners.get(type) ?? []) listener(new Event(type));
    },
  };
}

function stubGetBattery(battery: MockBattery): void {
  vi.stubGlobal('navigator', {
    ...navigator,
    getBattery: vi.fn(async () => battery),
  });
}

describe('useRendererSettings battery saver', () => {
  beforeEach(() => {
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: () => ({
        matches: false,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      }),
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    localStorage.clear();
  });

  it('does not force performance mode when the battery is charged and above the threshold', async () => {
    const battery = mockBattery(0.9, true);
    stubGetBattery(battery);
    const { result } = renderHook(() => useRendererSettings());

    await waitFor(() => expect(result.current.batterySaver).toBe(false));
    expect(result.current.effectivePerformanceMode).toBe('auto');
  });

  it('flips effectivePerformanceMode to performance when unplugged and low, per the Battery Status API shape (level/charging, not save)', async () => {
    const battery = mockBattery(0.15, false);
    stubGetBattery(battery);
    const { result } = renderHook(() => useRendererSettings());

    await waitFor(() => expect(result.current.batterySaver).toBe(true));
    expect(result.current.effectivePerformanceMode).toBe('performance');
    expect(result.current.isPerformanceForced).toBe(true);
  });

  it('does not trip on a low level while charging', async () => {
    const battery = mockBattery(0.1, true);
    stubGetBattery(battery);
    const { result } = renderHook(() => useRendererSettings());

    await waitFor(() => expect(result.current.settings).toBeDefined());
    expect(result.current.batterySaver).toBe(false);
  });

  it('reacts to levelchange/chargingchange events after mount', async () => {
    const battery = mockBattery(0.9, true);
    stubGetBattery(battery);
    const { result } = renderHook(() => useRendererSettings());
    await waitFor(() => expect(result.current.batterySaver).toBe(false));

    act(() => {
      battery.level = 0.05;
      battery.charging = false;
      battery.dispatch('levelchange');
    });

    await waitFor(() => expect(result.current.batterySaver).toBe(true));
  });
});
