import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import SettingsDrawer from '../SettingsDrawer';
import { DEFAULT_MODE } from '../../../data/sessionModes';
import { DEFAULT_INSTRUCTOR_SETTINGS } from '../../../types/instructorVideo';
import { DEFAULT_RENDERER_SETTINGS } from '../../../types/renderer';

const baseProps = {
  open: true,
  onClose: vi.fn(),
  selectedMode: DEFAULT_MODE,
  settings: { inhale: 4, hold1: 4, exhale: 4, hold2: 4 },
  updateSettings: vi.fn(),
  environmentOverride: 'auto' as const,
  setEnvironmentOverride: vi.fn(),
  canUseInstructor: false,
  instructorSettings: DEFAULT_INSTRUCTOR_SETTINGS,
  updateInstructorSettings: vi.fn(),
  rendererSettings: DEFAULT_RENDERER_SETTINGS,
  updateRendererSettings: vi.fn(),
  effectivePerformanceMode: 'auto' as const,
  isPerformanceForced: false,
  exportLedgerJson: () => '{"version":1,"sessions":[]}',
  importLedgerJson: vi.fn(() => ({
    envelope: { version: 1 as const, sessions: [] },
    imported: 3,
    duplicates: 2,
    conflicts: 1,
    capDiscarded: 4,
    baseline: 'conflict' as const,
  })),
};

describe('SettingsDrawer history portability', () => {
  it('shows detailed feedback after a validated import', async () => {
    const file = new File(['{}'], 'history.json', { type: 'application/json' });
    Object.defineProperty(file, 'text', { value: async () => '{}' });
    render(<SettingsDrawer {...baseProps} />);
    expect(screen.getByRole('dialog', { name: 'Customize Breath' })).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Import practice history JSON'), { target: { files: [file] } });
    await waitFor(() => expect(baseProps.importLedgerJson).toHaveBeenCalledWith('{}'));
    expect(screen.getByRole('status').textContent).toContain('3 imported, 2 duplicates, 1 timestamp conflicts, 4 discarded');
    expect(screen.getByRole('status').textContent).toContain('Baseline conflict');
  });

  it('reports rejection without replacing the UI state', async () => {
    const reject = vi.fn(() => { throw new Error('Unsupported version'); });
    const file = new File(['{}'], 'history.json', { type: 'application/json' });
    Object.defineProperty(file, 'text', { value: async () => '{}' });
    render(<SettingsDrawer {...baseProps} importLedgerJson={reject} />);
    fireEvent.change(screen.getByLabelText('Import practice history JSON'), { target: { files: [file] } });
    expect((await screen.findByRole('status')).textContent).toContain('Import rejected: Unsupported version');
  });
});
