import { useCallback, useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import type { TemplateSummary } from '@/lib/types';

// list + delete for the "My routines" screen and the workout-start picker;
// create/edit live in useRoutineEditor.ts
export function useWorkoutTemplates() {
  const [templates, setTemplates] = useState<TemplateSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(() => {
    setLoading(true);
    setError(null);
    return apiFetch('/workout-templates')
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json() as Promise<TemplateSummary[]>;
      })
      .then(setTemplates)
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  const remove = useCallback(async (id: string) => {
    const res = await apiFetch(`/workout-templates/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    setTemplates((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return { templates, loading, error, reload, remove };
}
