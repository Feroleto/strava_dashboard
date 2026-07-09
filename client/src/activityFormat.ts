export const WORKOUT_LABEL: Record<string, string> = {
  EASY_OR_LONG: 'Fácil/longa',
  INTERVAL: 'Intervalo',
  HILL_REPEATS: 'Subida',
};

// dot/badge colors per workout type (tokens from index.css)
export const WORKOUT_META: Record<
  string,
  { label: string; dot: string; badgeBg: string; badgeColor: string }
> = {
  EASY_OR_LONG: {
    label: 'Fácil/longa',
    dot: 'var(--dot-easy)',
    badgeBg: 'var(--neutral-bg)',
    badgeColor: 'var(--neutral)',
  },
  INTERVAL: {
    label: 'Intervalo',
    dot: 'var(--acc)',
    badgeBg: 'var(--acc-bg)',
    badgeColor: 'var(--acc-tx)',
  },
  HILL_REPEATS: {
    label: 'Subida',
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

/** "29h 16m" | "42min" — rail totals */
export function formatDuration(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.round((sec % 3600) / 60);
  return h > 0 ? `${h}h ${m.toString().padStart(2, '0')}m` : `${m}min`;
}

/** "1h11" | "58min" — activity rows */
export function formatDurationShort(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.round((sec % 3600) / 60);
  return h > 0 ? `${h}h${m.toString().padStart(2, '0')}` : `${m}min`;
}

/** "DD/MM" */
export function formatDayMonth(d: Date): string {
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
}
