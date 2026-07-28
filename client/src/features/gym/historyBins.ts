import { startOfBin, nextBin } from '@/features/dashboard/bins';
import type { WorkoutHistoryItem } from '@/lib/types';

export interface WeekVolume {
  start: Date;
  volumeKg: number;
}

// last n weeks (Monday-start, local time), ascending, zero-filled, current
// partial week included — same convention as dashboard/bins.ts's
// aggregateWeeks (startOfBin/nextBin are generic, reused cross-feature the
// same way useTrainingMetrics.ts already does)
export function aggregateWeeklyVolume(items: WorkoutHistoryItem[], n: number): WeekVolume[] {
  const monday = startOfBin(new Date(), 'week');
  const from = new Date(monday);
  from.setDate(from.getDate() - 7 * (n - 1));

  const bins: WeekVolume[] = [];
  for (let start = from; start <= monday; start = nextBin(start, 'week')) {
    const end = nextBin(start, 'week');
    const volumeKg = items.reduce((sum, w) => {
      const d = new Date(w.startedAt);
      return d >= start && d < end ? sum + w.volumeKg : sum;
    }, 0);
    bins.push({ start, volumeKg });
  }
  return bins;
}

export interface WorkoutWeekGroup {
  start: Date;
  volumeKg: number;
  workouts: WorkoutHistoryItem[];
}

// groups finished workouts by Monday-start local week, most recent week
// first — only weeks with at least one workout produce a group (unlike
// aggregateWeeklyVolume above, which zero-fills a fixed window for the bar
// chart). `items` is already ordered desc by startedAt (see
// useWorkoutHistory), so pushing in iteration order keeps each group's
// `workouts` desc too, without a separate sort per group
export function groupWorkoutsByWeek(items: WorkoutHistoryItem[]): WorkoutWeekGroup[] {
  const groups = new Map<number, WorkoutWeekGroup>();
  for (const w of items) {
    const start = startOfBin(new Date(w.startedAt), 'week');
    const key = start.getTime();
    let group = groups.get(key);
    if (!group) {
      group = { start, volumeKg: 0, workouts: [] };
      groups.set(key, group);
    }
    group.volumeKg += w.volumeKg;
    group.workouts.push(w);
  }
  return Array.from(groups.values()).sort((a, b) => b.start.getTime() - a.start.getTime());
}
