import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';

// fetch-once + PATCH-on-save; same shape as useActivityLaps, plus a mutator
export function useMaxHr() {
  const [maxHr, setMaxHr] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch('/users/me')
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((data: { maxHr: number | null }) => {
        setMaxHr(data.maxHr);
        setError(null);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  async function save(value: number): Promise<void> {
    const res = await apiFetch('/users/me', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ maxHr: value }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data: { maxHr: number | null } = await res.json();
    setMaxHr(data.maxHr);
  }

  return { maxHr, loading, error, save };
}
