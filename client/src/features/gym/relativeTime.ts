import type { TFunction } from 'i18next';

const DAY_MS = 86_400_000;

export type RelativeUnit = 'today' | 'yesterday' | 'days' | 'weeks' | 'months' | 'years';

export interface RelativeTime {
  unit: RelativeUnit;
  count: number;
}

// pure so it's testable without mounting a component — same reasoning as
// computeWeekMetrics in useTrainingMetrics.ts
export function relativeTimeFromNow(iso: string, now: number = Date.now()): RelativeTime {
  const diffDays = Math.floor(Math.max(0, now - new Date(iso).getTime()) / DAY_MS);
  if (diffDays === 0) return { unit: 'today', count: 0 };
  if (diffDays === 1) return { unit: 'yesterday', count: 1 };
  if (diffDays < 7) return { unit: 'days', count: diffDays };
  if (diffDays < 35) return { unit: 'weeks', count: Math.round(diffDays / 7) };
  if (diffDays < 365) return { unit: 'months', count: Math.round(diffDays / 30) };
  return { unit: 'years', count: Math.round(diffDays / 365) };
}

// shared by RoutinesListPage and RoutineDetailPage — both render the same
// "last performed" phrasing off the gym.json 'routines' namespace
export function formatLastPerformed(t: TFunction, iso: string): string {
  const { unit, count } = relativeTimeFromNow(iso);
  switch (unit) {
    case 'today':
      return t('routines.today');
    case 'yesterday':
      return t('routines.yesterday');
    case 'days':
      return t('routines.daysAgo', { count });
    case 'weeks':
      return t('routines.weeksAgo', { count });
    case 'months':
      return t('routines.monthsAgo', { count });
    default:
      return t('routines.yearsAgo', { count });
  }
}
