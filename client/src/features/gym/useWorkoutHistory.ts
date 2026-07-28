import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import type { WorkoutHistoryItem } from '@/lib/types';

// GET /workouts/history-stats — a 180-day window of finished workouts,
// ordered desc by startedAt. The "Histórico" tab aggregates this client-side
// into the 12-week KPI/bar series (historyBins.ts) and takes the first 6 for
// the "Recentes" list, same shape as useActivities feeding Dashboard.tsx
export function useWorkoutHistory() {
  const [items, setItems] = useState<WorkoutHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    apiFetch('/workouts/history-stats')
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json() as Promise<WorkoutHistoryItem[]>;
      })
      .then((data) => {
        if (!cancelled) setItems(data);
      })
      .catch((e) => {
        if (!cancelled) setError(String(e));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return { items, loading, error };
}
