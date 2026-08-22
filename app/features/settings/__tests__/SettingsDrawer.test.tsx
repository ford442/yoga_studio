import { render, screen } from '@testing-library/react';
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
};

describe('SettingsDrawer', () => {
  it('notes that practice history persistence is paused', () => {
    render(<SettingsDrawer {...baseProps} />);
    expect(screen.getByRole('dialog', { name: 'Customize Breath' })).toBeTruthy();
    expect(screen.getByText(/Session recording and history sync are paused/i)).toBeTruthy();
    expect(screen.queryByLabelText('Import practice history JSON')).toBeNull();
    expect(screen.queryByRole('button', { name: 'EXPORT JSON' })).toBeNull();
  });
});
