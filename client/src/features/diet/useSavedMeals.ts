import { useCallback, useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import type { SavedMealSummary } from '@/lib/types';

// list + delete for the "Refeições salvas" screen inside AddMealPage;
// create/edit live in useSavedMealEditor.ts — mirrors useWorkoutTemplates.ts
export function useSavedMeals() {
  const [meals, setMeals] = useState<SavedMealSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(() => {
    setLoading(true);
    setError(null);
    return apiFetch('/saved-meals')
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json() as Promise<SavedMealSummary[]>;
      })
      .then(setMeals)
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  const remove = useCallback(async (id: string) => {
    const res = await apiFetch(`/saved-meals/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    setMeals((prev) => prev.filter((m) => m.id !== id));
  }, []);

  return { meals, loading, error, reload, remove };
}
