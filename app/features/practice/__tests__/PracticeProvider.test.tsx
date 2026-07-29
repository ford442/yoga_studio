import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PracticeProvider, usePractice } from '../PracticeProvider';

const mocks = vi.hoisted(() => ({
  recordOptions: vi.fn(),
  sessionSettings: { inhale: 4, hold1: 4, exhale: 6, hold2: 2 },
  startSession: vi.fn(),
  toggleFree: vi.fn(),
  reset: vi.fn(),
}));

vi.mock('../../session/SessionProvider', () => ({
  useSession: () => ({
    breathPhase: 0,
    isRunning: true,
    currentPhase: 'inhale',
    settings: mocks.sessionSettings,
    sessionDuration: null,
    totalBreaths: 0,
    completedSegment: null,
    activeSegmentId: 42,
    totalCycle: 16,
    phaseProgress: 0,
    remaining: 4,
    phaseDuration: 4,
    intensity: 0,
    startSession: mocks.startSession,
    toggleFree: mocks.toggleFree,
    reset: mocks.reset,
    updateSettings: (patch: Partial<typeof mocks.sessionSettings>) => {
      Object.assign(mocks.sessionSettings, patch);
    },
  }),
}));

vi.mock('../../../hooks/useBreathAudio', () => ({ useBreathAudio: vi.fn() }));
vi.mock('../../../hooks/useSessionRecorder', () => ({
  useSessionRecorder: (options: unknown) => mocks.recordOptions(options),
}));

function PracticeProbe() {
  const practice = usePractice();
  return (
    <>
      <span data-testid="selector-state">{practice.program.selectorOpen ? 'open' : 'closed'}</span>
      <span data-testid="mode-id">{practice.practice.selectedMode.id}</span>
      <button type="button" onClick={practice.program.openSelector}>Open programs</button>
      <button
        type="button"
        onClick={() => practice.program.selectProgramAndClose('focus-reset')}
      >
        Select program
      </button>
      <button
        type="button"
        onClick={() => practice.program.startSession('focus-reset', 1)}
      >
        Start program day
      </button>
    </>
  );
}

describe('PracticeProvider', () => {
  beforeEach(() => {
    localStorage.clear();
    mocks.recordOptions.mockClear();
    mocks.startSession.mockClear();
    Object.assign(mocks.sessionSettings, { inhale: 4, hold1: 4, exhale: 6, hold2: 2 });
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: () => ({
        matches: false,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      }),
    });
  });

  it('throws a clear error outside its provider', () => {
    function OutsideConsumer() {
      usePractice();
      return null;
    }

    expect(() => render(<OutsideConsumer />)).toThrow(
      'usePractice must be used within a PracticeProvider',
    );
  });

  it('closes the program selector as part of the select intent', () => {
    render(
      <PracticeProvider>
        <PracticeProbe />
      </PracticeProvider>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Open programs' }));
    expect(screen.getByTestId('selector-state').textContent).toBe('open');

    fireEvent.click(screen.getByRole('button', { name: 'Select program' }));
    expect(screen.getByTestId('selector-state').textContent).toBe('closed');
  });

  it('supplies the active program, technique, and breath snapshot to session recording', async () => {
    render(
      <PracticeProvider>
        <PracticeProbe />
      </PracticeProvider>,
    );

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Start program day' }));
    });

    await waitFor(() => expect(screen.getByTestId('mode-id').textContent).toBe('nadi-shodhana'));
    const latestOptions = mocks.recordOptions.mock.calls.at(-1)?.[0];
    expect(latestOptions).toMatchObject({
      activeSegmentId: 42,
      isRunning: true,
      modeId: 'nadi-shodhana',
      programId: 'focus-reset',
      settings: { inhale: 4, hold1: 4, exhale: 4, hold2: 2 },
    });
    expect(mocks.startSession).toHaveBeenCalledWith(10);
  });
});
