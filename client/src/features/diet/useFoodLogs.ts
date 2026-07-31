import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import type { DailySummary, FoodLogItem } from '@/lib/types';

export function localDateString(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// fetches one day's logs + summary together; pass a changing refreshKey to
// force a refetch (e.g. after logging or deleting an entry) — same pattern
// as useActivities.ts
export function useFoodLogs(date: string, refreshKey = 0) {
  const [logs, setLogs] = useState<FoodLogItem[]>([]);
  const [summary, setSummary] = useState<DailySummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([
      apiFetch(`/food-logs?date=${date}`).then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json() as Promise<FoodLogItem[]>;
      }),
      apiFetch(`/food-logs/summary?date=${date}`).then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json() as Promise<DailySummary>;
      }),
    ])
      .then(([logsData, summaryData]) => {
        if (cancelled) return;
        setLogs(logsData);
        setSummary(summaryData);
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
  }, [date, refreshKey]);

  return { logs, summary, loading, error };
}
