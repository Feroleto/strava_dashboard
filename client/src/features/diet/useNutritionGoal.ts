import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import type { NutritionGoal } from '@/lib/types';

// fetch-once + PATCH-on-save, mirrors useMaxHr.ts
export function useNutritionGoal() {
  const [goal, setGoal] = useState<NutritionGoal | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch('/users/me')
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((data: NutritionGoal) => {
        setGoal(data);
        setError(null);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  async function save(next: NutritionGoal): Promise<void> {
    const res = await apiFetch('/users/me', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(next),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data: NutritionGoal = await res.json();
    setGoal(data);
  }

  return { goal, loading, error, save };
}
