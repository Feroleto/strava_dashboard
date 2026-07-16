import { useEffect, useState } from 'react';
import type { ActivityLapPoint, ActivityLapsResponse } from '@/lib/types';
import { apiFetch } from '@/lib/api';

// fetches every lap across the user's full history once (Run > Analysis is
// sourced from lap-level data, not whole-activity aggregates, so interval/hill
// sessions aren't blended into one flat average); same fetch-once pattern as
// useActivities
export function useActivityLaps() {
  const [laps, setLaps] = useState<ActivityLapPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch('/activities/laps')
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((data: ActivityLapsResponse) => {
        setLaps(data.items);
        setError(null);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  return { laps, loading, error };
}
