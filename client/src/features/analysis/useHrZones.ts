import { useEffect, useState } from 'react';
import type { ActivityHrZonePoint, ActivityHrZonesResponse } from '@/lib/types';

// fetches real per-activity HR zone time distribution once (Strava premium
// only — empty for activities without it); same fetch-once pattern as
// useActivityLaps/useMaxHr
export function useHrZones() {
  const [zones, setZones] = useState<ActivityHrZonePoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('http://localhost:3000/activities/hr-zones')
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((data: ActivityHrZonesResponse) => {
        setZones(data.items);
        setError(null);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  return { zones, loading, error };
}
