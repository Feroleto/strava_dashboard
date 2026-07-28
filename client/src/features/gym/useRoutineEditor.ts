import { useCallback, useEffect, useRef, useState } from 'react';
import { apiFetch } from '@/lib/api';
import type { TemplateDetail, TemplateExerciseTargets } from '@/lib/types';

export interface WorkingExercise extends TemplateExerciseTargets {
  // server templateExerciseId once persisted, a local-only key before that
  // (create mode never round-trips to the server until the final submit)
  key: string;
  exerciseId: string;
  exerciseName: string;
}

let localKeySeq = 0;
function nextLocalKey(): string {
  localKeySeq += 1;
  return `local-${localKeySeq}`;
}

// Moves `key` to sit where `beforeKey` currently is — same shape as the lap
// editor's reorderLaps (lapBoundaryMath.ts), called continuously while
// dragging (once per row boundary crossed), not just on drop.
export function reorderWorkingExercises(
  exercises: WorkingExercise[],
  key: string,
  beforeKey: string,
): WorkingExercise[] {
  if (key === beforeKey) return exercises;
  const fromIndex = exercises.findIndex((e) => e.key === key);
  const targetIndex = exercises.findIndex((e) => e.key === beforeKey);
  if (fromIndex === -1 || targetIndex === -1) return exercises;

  const next = exercises.slice();
  const [item] = next.splice(fromIndex, 1);
  const insertAt = next.findIndex((e) => e.key === beforeKey);
  next.splice(insertAt, 0, item!);
  return next;
}

function toWorking(template: TemplateDetail): WorkingExercise[] {
  return template.exercises
    .slice()
    .sort((a, b) => a.order - b.order)
    .map((e) => ({
      key: e.id,
      exerciseId: e.exerciseId,
      exerciseName: e.exerciseName,
      targetSets: e.targetSets,
      targetRepsMin: e.targetRepsMin,
      targetRepsMax: e.targetRepsMax,
    }));
}

// create mode builds the whole routine locally and submits it in one POST
// (matches the backend contract: exercises can be supplied at creation
// time). Edit mode persists every action immediately against the
// templateId's sub-resources — same "commit as you go" model already used
// by the live workout session (useActiveWorkout), no bulk-replace endpoint
// exists or is needed
export function useRoutineEditor(templateId: string | null) {
  const isEdit = templateId !== null;
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [exercises, setExercises] = useState<WorkingExercise[]>([]);
  // kept in sync below so commitReorder always reads the true latest array —
  // it's invoked from RoutineEditPage's pointerup handler, which is bound
  // once per drag gesture (the effect only re-runs on dragKey, not on every
  // mid-drag reorder) and would otherwise close over the pre-drag exercises
  // state, diffing against itself and silently sending zero PATCH calls
  const exercisesRef = useRef(exercises);
  useEffect(() => {
    exercisesRef.current = exercises;
  }, [exercises]);
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isEdit) return;
    let cancelled = false;
    apiFetch(`/workout-templates/${templateId}`)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json() as Promise<TemplateDetail>;
      })
      .then((t) => {
        if (cancelled) return;
        setName(t.name);
        setDescription(t.description ?? '');
        setExercises(toWorking(t));
      })
      .catch((e) => {
        if (!cancelled) setError(String(e));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isEdit, templateId]);

  const applyServerUpdate = (template: TemplateDetail) => {
    setName(template.name);
    setDescription(template.description ?? '');
    setExercises(toWorking(template));
  };

  const addExercise = useCallback(
    // targets is optional and additive — omitted by every existing caller
    // (desktop's ExercisePicker flow), used by the new mobile multi-select
    // picker to seed the "3 séries x 12 reps" default on add
    async (exerciseId: string, exerciseName: string, targets?: TemplateExerciseTargets) => {
      if (!isEdit) {
        setExercises((prev) => [
          ...prev,
          { key: nextLocalKey(), exerciseId, exerciseName, ...targets },
        ]);
        return;
      }
      setSaving(true);
      setError(null);
      try {
        const res = await apiFetch(`/workout-templates/${templateId}/exercises`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ exerciseId, ...targets }),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        applyServerUpdate(await res.json());
      } catch (e) {
        setError(String(e));
      } finally {
        setSaving(false);
      }
    },
    [isEdit, templateId],
  );

  const updateTargets = useCallback(
    async (key: string, targets: TemplateExerciseTargets) => {
      if (!isEdit) {
        setExercises((prev) => prev.map((e) => (e.key === key ? { ...e, ...targets } : e)));
        return;
      }
      setSaving(true);
      setError(null);
      try {
        const res = await apiFetch(`/workout-templates/${templateId}/exercises/${key}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(targets),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        applyServerUpdate(await res.json());
      } catch (e) {
        setError(String(e));
      } finally {
        setSaving(false);
      }
    },
    [isEdit, templateId],
  );

  const removeExercise = useCallback(
    async (key: string) => {
      if (!isEdit) {
        setExercises((prev) => prev.filter((e) => e.key !== key));
        return;
      }
      setSaving(true);
      setError(null);
      try {
        const res = await apiFetch(`/workout-templates/${templateId}/exercises/${key}`, {
          method: 'DELETE',
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        applyServerUpdate(await res.json());
      } catch (e) {
        setError(String(e));
      } finally {
        setSaving(false);
      }
    },
    [isEdit, templateId],
  );

  const move = useCallback(
    async (key: string, direction: -1 | 1) => {
      const idx = exercises.findIndex((e) => e.key === key);
      const swapIdx = idx + direction;
      if (idx === -1 || swapIdx < 0 || swapIdx >= exercises.length) return;

      if (!isEdit) {
        setExercises((prev) => {
          const next = prev.slice();
          [next[idx], next[swapIdx]] = [next[swapIdx]!, next[idx]!];
          return next;
        });
        return;
      }

      // reorder is one PATCH per affected exercise (spec: "manter simples
      // nesta fase") — swap the two rows' order values, 1-based positions
      setSaving(true);
      setError(null);
      try {
        const a = exercises[idx]!;
        const b = exercises[swapIdx]!;
        await apiFetch(`/workout-templates/${templateId}/exercises/${a.key}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ order: swapIdx + 1 }),
        });
        const res = await apiFetch(`/workout-templates/${templateId}/exercises/${b.key}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ order: idx + 1 }),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        applyServerUpdate(await res.json());
      } catch (e) {
        setError(String(e));
      } finally {
        setSaving(false);
      }
    },
    [exercises, isEdit, templateId],
  );

  // Local-only reorder, called live while dragging (mobile builder's grip
  // handle) — no network call per crossing, same reasoning as the lap
  // editor's reorderLap: a PATCH per pixel of drag would spam the API. Edit
  // mode persists once, on drop, via commitReorder below.
  const reorderExercise = useCallback((key: string, beforeKey: string) => {
    setExercises((prev) => reorderWorkingExercises(prev, key, beforeKey));
  }, []);

  // Called once when the drag ends (pointerup), with the key order captured
  // at drag start. No-op in create mode (the reordered local array is
  // already what submitCreate sends) and a no-op if the drag didn't
  // actually change anything. Otherwise PATCHes `order` for every exercise
  // whose position moved — same "one PATCH per affected row, no batch
  // endpoint" contract as the up/down `move` above, just diffed against a
  // snapshot instead of a single swap.
  const commitReorder = useCallback(
    async (originalKeys: string[]) => {
      if (!isEdit) return;
      const current = exercisesRef.current;
      const changedIndexes = current
        .map((e, idx) => (originalKeys[idx] !== e.key ? idx : -1))
        .filter((idx) => idx !== -1);
      if (changedIndexes.length === 0) return;

      setSaving(true);
      setError(null);
      try {
        let lastResBody: TemplateDetail | null = null;
        for (const idx of changedIndexes) {
          const res = await apiFetch(
            `/workout-templates/${templateId}/exercises/${current[idx]!.key}`,
            {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ order: idx + 1 }),
            },
          );
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          lastResBody = await res.json();
        }
        if (lastResBody) applyServerUpdate(lastResBody);
      } catch (e) {
        setError(String(e));
      } finally {
        setSaving(false);
      }
    },
    [isEdit, templateId],
  );

  const saveMeta = useCallback(async () => {
    if (!isEdit) return;
    setSaving(true);
    setError(null);
    try {
      const res = await apiFetch(`/workout-templates/${templateId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, description: description || null }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      applyServerUpdate(await res.json());
      return true;
    } catch (e) {
      setError(String(e));
      return false;
    } finally {
      setSaving(false);
    }
  }, [isEdit, templateId, name, description]);

  const submitCreate = useCallback(async (): Promise<TemplateDetail | null> => {
    setSaving(true);
    setError(null);
    try {
      const res = await apiFetch('/workout-templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          description: description || undefined,
          exercises: exercises.map((e) => ({
            exerciseId: e.exerciseId,
            targetSets: e.targetSets,
            targetRepsMin: e.targetRepsMin,
            targetRepsMax: e.targetRepsMax,
          })),
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return (await res.json()) as TemplateDetail;
    } catch (e) {
      setError(String(e));
      return null;
    } finally {
      setSaving(false);
    }
  }, [name, description, exercises]);

  return {
    isEdit,
    name,
    setName,
    description,
    setDescription,
    exercises,
    loading,
    saving,
    error,
    addExercise,
    updateTargets,
    removeExercise,
    move,
    reorderExercise,
    commitReorder,
    saveMeta,
    submitCreate,
  };
}
