import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import TrendsSheet from '../TrendsSheet';
import StatsHeader from '../../features/session/StatsHeader';

const trends = Array.from({ length: 28 }, (_, index) => ({
  date: `2026-07-${String(index + 1).padStart(2, '0')}`,
  durationSec: index * 60,
  minutes: index,
}));

describe('practice trends UI', () => {
  it('opens from the accessible stats cluster', () => {
    const onOpenTrends = vi.fn();
    render(<StatsHeader todayMinutes={5} todayBreaths={18} currentStreak={3} onOpenTrends={onOpenTrends} />);
    fireEvent.click(screen.getByRole('button', { name: 'Open practice trends' }));
    expect(onOpenTrends).toHaveBeenCalledOnce();
  });

  it('renders 28 date buckets, technique labels, and unattributed baseline copy', () => {
    render(
      <TrendsSheet
        open
        onClose={() => {}}
        trends={trends}
        techniqueTotals={[
          { techniqueId: 'ujjayi', durationSec: 700, minutes: 11, breaths: 30 },
          { techniqueId: 'retired-id', durationSec: 300, minutes: 5, breaths: 12 },
        ]}
        legacyBaseline={{ todayMinutes: 8, todayBreaths: 20, currentStreak: 2, lastPracticeDate: '2026-07-01' }}
      />,
    );
    expect(screen.getByRole('dialog', { name: 'Practice trends' })).toBeTruthy();
    expect(document.querySelectorAll('[data-date]')).toHaveLength(28);
    expect(screen.getByText(/Ujjayi/)).toBeTruthy();
    expect(screen.getByText('retired-id')).toBeTruthy();
    expect(screen.getByText(/cannot be truthfully assigned/)).toBeTruthy();
  });

  it('closes with Escape and the focused dialog close button', () => {
    const onClose = vi.fn();
    render(<TrendsSheet open onClose={onClose} trends={trends} techniqueTotals={[]} />);
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Close practice trends' }));
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledOnce();
  });
});
