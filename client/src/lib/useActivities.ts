import { useEffect, useState } from 'react';
import type { ActivitiesResponse, Activity } from './types';
import { apiFetch } from './api';
import { takeActivitiesPrefetch } from './boot';

// fetches the whole run history once; consumers filter/aggregate client-side.
// pass a changing refreshKey to force a refetch (e.g. after a sync completes)
export function useActivities(refreshKey = 0) {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchFresh = (): Promise<ActivitiesResponse> =>
      apiFetch('/activities?limit=1000').then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      });
    // initial mount may ride the optimistic prefetch started in lib/boot.ts;
    // a failed prefetch falls back to a fresh request, so an error only
    // reaches the UI after a real retry. refreshKey !== 0 (post-sync) always
    // hits the network for up-to-date data
    const prefetched = refreshKey === 0 ? takeActivitiesPrefetch() : null;
    (prefetched ? prefetched.catch(fetchFresh) : fetchFresh())
      .then((data) => {
        setActivities(data.items);
        setError(null);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [refreshKey]);

  return { activities, loading, error };
}
