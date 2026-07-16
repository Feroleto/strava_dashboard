import { useEffect, useState } from 'react';
import type { ActivitiesResponse, Activity } from './types';
import { apiFetch } from './api';

// fetches the whole run history once; consumers filter/aggregate client-side.
// pass a changing refreshKey to force a refetch (e.g. after a sync completes)
export function useActivities(refreshKey = 0) {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch('/activities?limit=1000')
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((data: ActivitiesResponse) => {
        setActivities(data.items);
        setError(null);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [refreshKey]);

  return { activities, loading, error };
}
