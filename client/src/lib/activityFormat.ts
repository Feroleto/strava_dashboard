import { currentIntlLocale } from '@/lib/dateLocale';

// dot/badge colors per workout type (tokens from index.css); labelKey points
// into the 'common' i18n namespace, translate at render time
export const WORKOUT_META: Record<
  string,
  { labelKey: string; dot: string; badgeBg: string; badgeColor: string }
> = {
  EASY_OR_LONG: {
    labelKey: 'workout.easyLong',
    dot: 'var(--dot-easy)',
    badgeBg: 'var(--neutral-bg)',
    badgeColor: 'var(--neutral)',
  },
  INTERVAL: {
    labelKey: 'workout.interval',
    dot: 'var(--acc)',
    badgeBg: 'var(--acc-bg)',
    badgeColor: 'var(--acc-tx)',
  },
  HILL_REPEATS: {
    labelKey: 'workout.hillRepeats',
    dot: 'var(--pos)',
    badgeBg: 'var(--pos-bg)',
    badgeColor: 'var(--pos)',
  },
};

export function formatKm(km: number): string {
  return km.toFixed(1);
}

export function formatPace(secPerKm: number | null): string {
  if (!secPerKm || !isFinite(secPerKm)) return '—';
  let min = Math.floor(secPerKm / 60);
  let sec = Math.round(secPerKm % 60);
  if (sec === 60) {
    min++;
    sec = 0;
  }
  return `${min}:${sec.toString().padStart(2, '0')} /km`;
}

// "29h 16m" | "42min" — rail totals
export function formatDuration(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.round((sec % 3600) / 60);
  return h > 0 ? `${h}h ${m.toString().padStart(2, '0')}m` : `${m}min`;
}

// "1h11" | "58min" — activity rows
export function formatDurationShort(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.round((sec % 3600) / 60);
  return h > 0 ? `${h}h${m.toString().padStart(2, '0')}` : `${m}min`;
}

// "4:32" — lap durations
export function formatMinSec(sec: number): string {
  let m = Math.floor(sec / 60);
  let s = Math.round(sec % 60);
  if (s === 60) {
    m++;
    s = 0;
  }
  return `${m}:${s.toString().padStart(2, '0')}`;
}

// "21:46" | "1:51:45" — best-effort times, hours shown only when ≥ 1h
export function formatHms(sec: number): string {
  const h = Math.floor(sec / 3600);
  if (h === 0) return formatMinSec(sec);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.round(sec % 60);
  return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

// "DD/MM"
export function formatDayMonth(d: Date): string {
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
}

// removing dot from toLocaleDateString
export function formatMonthShort(d: Date): string {
  return d
    .toLocaleDateString(currentIntlLocale(), { month: 'short' })
    .replace('.', '');
}

// January 2026
export function formatMonthLong(d: Date): string {
  const s = d.toLocaleDateString(currentIntlLocale(), {
    month: 'long',
    year: 'numeric',
  });
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function formatNumber(n: number): string {
  return n.toLocaleString(currentIntlLocale());
}

// "Jul 2025"
export function formatMonthShortYear(d: Date): string {
  return `${formatMonthShort(d)} ${d.getFullYear()}`;
}

// "Jul 5"
export function formatMonthDay(d: Date): string {
  return `${formatMonthShort(d)} ${d.getDate()}`;
}

// "Jul 5, 2025"
export function formatMonthDayYear(d: Date): string {
  return `${formatMonthDay(d)}, ${d.getFullYear()}`;
}
