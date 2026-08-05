import { useCallback, useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import type { Meal, MealType } from '@/lib/types';

// The day's meal slots — a per-user configuration that applies to every date,
// not a per-day list. Every mutation replies with the whole refreshed list
// (reordering renumbers several rows at once), so nothing here patches local
// state by hand — same convention as the workout endpoints returning the full
// WorkoutDetail.
export function useMeals() {
  const [meals, setMeals] = useState<Meal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(() => {
    setError(null);
    return apiFetch('/meals')
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json() as Promise<Meal[]>;
      })
      .then(setMeals)
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  const mutate = useCallback(async (path: string, init: RequestInit) => {
    const res = await apiFetch(path, {
      ...init,
      ...(init.body !== undefined && { headers: { 'Content-Type': 'application/json' } }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    setMeals((await res.json()) as Meal[]);
  }, []);

  const add = useCallback(
    (type: MealType) => mutate('/meals', { method: 'POST', body: JSON.stringify({ type }) }),
    [mutate],
  );

  const rename = useCallback(
    (id: string, type: MealType) =>
      mutate(`/meals/${id}`, { method: 'PATCH', body: JSON.stringify({ type }) }),
    [mutate],
  );

  // the server assigns order from array position, so the full list goes over
  // the wire — a partial one is rejected rather than silently renumbering
  const reorder = useCallback(
    (ids: string[]) => mutate('/meals/order', { method: 'PUT', body: JSON.stringify({ ids }) }),
    [mutate],
  );

  const remove = useCallback(
    (id: string) => mutate(`/meals/${id}`, { method: 'DELETE' }),
    [mutate],
  );

  return { meals, loading, error, reload, add, rename, reorder, remove };
}
