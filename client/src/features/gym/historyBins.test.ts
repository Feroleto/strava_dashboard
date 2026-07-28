import { describe, it, expect } from 'vitest';
import { aggregateWeeklyVolume, groupWorkoutsByWeek } from './historyBins';
import { startOfBin } from '@/features/dashboard/bins';
import type { WorkoutHistoryItem } from '@/lib/types';

function stubWorkout(startedAt: string, volumeKg: number): WorkoutHistoryItem {
  return {
    id: startedAt,
    startedAt,
    finishedAt: startedAt,
    durationSec: 1800,
    exerciseCount: 1,
    volumeKg,
    templateId: null,
    templateName: null,
  };
}

describe('aggregateWeeklyVolume', () => {
  it('returns n weeks, ascending, ending on the current week', () => {
    const bins = aggregateWeeklyVolume([], 12);

    expect(bins).toHaveLength(12);
    const currentMonday = startOfBin(new Date(), 'week');
    expect(bins[bins.length - 1].start.getTime()).toBe(currentMonday.getTime());
    for (let i = 1; i < bins.length; i++) {
      expect(bins[i].start.getTime() - bins[i - 1].start.getTime()).toBe(7 * 86_400_000);
    }
  });

  it('zero-fills weeks with no workouts', () => {
    const bins = aggregateWeeklyVolume([], 4);
    expect(bins.every((b) => b.volumeKg === 0)).toBe(true);
  });

  it('buckets a workout into the week containing its startedAt date', () => {
    const currentMonday = startOfBin(new Date(), 'week');
    const midweek = new Date(currentMonday);
    midweek.setDate(midweek.getDate() + 2);

    const bins = aggregateWeeklyVolume([stubWorkout(midweek.toISOString(), 500)], 4);

    expect(bins[bins.length - 1].volumeKg).toBe(500);
    expect(bins.slice(0, -1).every((b) => b.volumeKg === 0)).toBe(true);
  });

  it('sums volume across multiple workouts in the same week', () => {
    const currentMonday = startOfBin(new Date(), 'week');

    const bins = aggregateWeeklyVolume(
      [
        stubWorkout(currentMonday.toISOString(), 200),
        stubWorkout(currentMonday.toISOString(), 300),
      ],
      1,
    );

    expect(bins[0].volumeKg).toBe(500);
  });
});

describe('groupWorkoutsByWeek', () => {
  it('returns no groups when there are no workouts', () => {
    expect(groupWorkoutsByWeek([])).toEqual([]);
  });

  it('groups workouts from the same week and sums their volume', () => {
    const currentMonday = startOfBin(new Date(), 'week');
    const midweek = new Date(currentMonday);
    midweek.setDate(midweek.getDate() + 2);

    const groups = groupWorkoutsByWeek([
      stubWorkout(currentMonday.toISOString(), 200),
      stubWorkout(midweek.toISOString(), 300),
    ]);

    expect(groups).toHaveLength(1);
    expect(groups[0].start.getTime()).toBe(currentMonday.getTime());
    expect(groups[0].volumeKg).toBe(500);
    expect(groups[0].workouts).toHaveLength(2);
  });

  it('orders groups most-recent week first, preserving desc order within a group', () => {
    const currentMonday = startOfBin(new Date(), 'week');
    const lastMonday = new Date(currentMonday);
    lastMonday.setDate(lastMonday.getDate() - 7);
    const lastMidweek = new Date(lastMonday);
    lastMidweek.setDate(lastMidweek.getDate() + 3);

    // items arrive already desc-sorted by startedAt, as the real API returns
    const groups = groupWorkoutsByWeek([
      stubWorkout(currentMonday.toISOString(), 100),
      stubWorkout(lastMidweek.toISOString(), 50),
      stubWorkout(lastMonday.toISOString(), 25),
    ]);

    expect(groups).toHaveLength(2);
    expect(groups[0].start.getTime()).toBe(currentMonday.getTime());
    expect(groups[1].start.getTime()).toBe(lastMonday.getTime());
    expect(groups[1].workouts.map((w) => w.startedAt)).toEqual([
      lastMidweek.toISOString(),
      lastMonday.toISOString(),
    ]);
  });
});
