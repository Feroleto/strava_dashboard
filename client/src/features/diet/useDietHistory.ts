import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import type { DailyHistoryPoint } from '@/lib/types';

// fetches the zero-filled per-day history for a range; pass a changing
// refreshKey to force a refetch — same pattern as useFoodLogs.ts
export function useDietHistory(days: 7 | 14, refreshKey = 0) {
  const [points, setPoints] = useState<DailyHistoryPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    apiFetch(`/food-logs/history?days=${days}`)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json() as Promise<DailyHistoryPoint[]>;
      })
      .then((data) => {
        if (cancelled) return;
        setPoints(data);
        setError(null);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [days, refreshKey]);

  return { points, loading, error };
}
