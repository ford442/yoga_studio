import { describe, it, expect } from 'vitest';
import { PROGRAMS, getProgramById, getNextSessionDay, isProgramComplete, getProgramTotalSessions, resolveProgramSessionTechnique } from '../programs';
import { TECHNIQUES } from '../techniques';

describe('PROGRAMS data', () => {
  it('has unique program ids', () => {
    const ids = PROGRAMS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('references only known techniques', () => {
    const techniqueIds = new Set(TECHNIQUES.map((t) => t.id));
    for (const program of PROGRAMS) {
      for (const day of program.days) {
        if (day.type === 'session') {
          expect(techniqueIds.has(day.techniqueId)).toBe(true);
        }
      }
    }
  });

  it('has valid session durations', () => {
    const validDurations: Array<5 | 10 | 15 | 'free'> = [5, 10, 15, 'free'];
    for (const program of PROGRAMS) {
      for (const day of program.days) {
        if (day.type === 'session') {
          expect(validDurations).toContain(day.durationMinutes);
        }
      }
    }
  });

  it('has contiguous day indices matching durationDays', () => {
    for (const program of PROGRAMS) {
      expect(program.days.length).toBe(program.durationDays);
      for (let i = 0; i < program.durationDays; i += 1) {
        expect(program.days[i].dayIndex).toBe(i);
      }
    }
  });

  it('includes the expected starter programs', () => {
    const ids = PROGRAMS.map((p) => p.id);
    expect(ids).toContain('beginner-calm-week');
    expect(ids).toContain('focus-reset');
    expect(ids).toContain('deep-evening-practice');
  });

  it('getProgramById returns the correct program', () => {
    expect(getProgramById('beginner-calm-week')?.label).toBe('Beginner Calm Week');
    expect(getProgramById('missing')).toBeUndefined();
  });

  it('resolveProgramSessionTechnique returns the matching technique', () => {
    const program = getProgramById('beginner-calm-week')!;
    const day = program.days[0];
    expect(day.type).toBe('session');
    const technique = resolveProgramSessionTechnique(day as import('../../types/program').ProgramSessionDay, TECHNIQUES);
    expect(technique.id).toBe(day.type === 'session' ? day.techniqueId : '');
  });

  it('getNextSessionDay skips rest days and completed days', () => {
    const program = getProgramById('beginner-calm-week')!;
    const progress = {
      programId: program.id,
      startDate: '2026-07-16',
      completedDays: [0, 1, 2],
    };
    const next = getNextSessionDay(program, progress);
    expect(next).toBeDefined();
    expect(next?.dayIndex).toBe(4); // day 3 is a rest day
  });

  it('getNextSessionDay returns undefined when all sessions are complete', () => {
    const program = getProgramById('focus-reset')!;
    const totalSessions = getProgramTotalSessions(program);
    const completedDays = program.days
      .filter((day) => day.type === 'session')
      .map((day) => day.dayIndex);
    expect(completedDays.length).toBe(totalSessions);

    const progress = {
      programId: program.id,
      startDate: '2026-07-16',
      completedDays,
    };
    expect(getNextSessionDay(program, progress)).toBeUndefined();
    expect(isProgramComplete(program, progress)).toBe(true);
  });
});
