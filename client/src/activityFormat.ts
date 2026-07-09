export const WORKOUT_LABEL: Record<string, string> = {
  EASY_OR_LONG: 'Easy or Long Run',
  INTERVAL: 'Interval',
  HILL_REPEATS: 'Hill Repeats',
};

export function formatPace(secPerKm: number | null): string {
  if (!secPerKm) return '—';
  const min = Math.floor(secPerKm / 60);
  const sec = Math.round(secPerKm % 60);
  return `${min}:${sec.toString().padStart(2, '0')} /km`;
}

export function formatDuration(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  if (h > 0)
    return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  if (m > 0) return `${m}:${s.toString().padStart(2, '0')}`;
  return `0:${s}`;
}
