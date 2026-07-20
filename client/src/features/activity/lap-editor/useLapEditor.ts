import { useCallback, useEffect, useMemo, useState } from 'react';
import { apiFetch } from '@/lib/api';
import type { ActivityDetail, ActivityLap, ActivityStreamPoint } from '@/lib/types';
import {
  computeProgress,
  reorderLaps,
  resolveWorkingLaps,
  type WorkingLap,
} from './lapBoundaryMath';

let keyCounter = 0;
function nextKey(): string {
  keyCounter += 1;
  return `new-lap-${keyCounter}`;
}

// Distance mode by default — preserves exactly what's already stored.
// (startSec/endSec looked like a tempting exact alternative, but they're
// not reliable across every lap origin: split-based laps always persist
// startSec=endSec=0 — see buildLapsFromSplits — and native-lap start_index/
// end_index are positions in Strava's raw stream, which isn't guaranteed
// 1-sample-per-second, so endSec-startSec doesn't equal real duration for
// those either. distanceM has none of that ambiguity — it's a plain
// physical quantity regardless of how the lap was created.)
function seedFromExisting(laps: ActivityLap[]): WorkingLap[] {
  return laps.map((lap) => ({
    key: lap.id,
    lapType: lap.lapType,
    sizeMode: 'distance',
    sizeValue: Math.round(lap.distanceM),
  }));
}

export function useLapEditor(activityId: string, initialLaps: ActivityLap[]) {
  const [points, setPoints] = useState<ActivityStreamPoint[] | null>(null);
  const [streamLoading, setStreamLoading] = useState(true);
  const [streamError, setStreamError] = useState<string | null>(null);

  const [laps, setLaps] = useState<WorkingLap[]>(() =>
    seedFromExisting(initialLaps),
  );
  const [dirty, setDirty] = useState(false);

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const loadStream = useCallback(() => {
    setStreamLoading(true);
    setStreamError(null);
    apiFetch(`/activities/${activityId}/streams`)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((data: { points: ActivityStreamPoint[] }) => setPoints(data.points))
      .catch((err) => setStreamError(err.message))
      .finally(() => setStreamLoading(false));
  }, [activityId]);

  useEffect(() => {
    loadStream();
  }, [loadStream]);

  const progress = useMemo(() => {
    if (!points) return { coveredM: 0, totalM: 0, isComplete: false, deficitM: 0 };
    return computeProgress(points, laps);
  }, [points, laps]);

  const resolved = useMemo(() => {
    if (!points) return [];
    return resolveWorkingLaps(points, laps).resolved;
  }, [points, laps]);

  function updateLap(
    key: string,
    patch: Partial<Pick<WorkingLap, 'lapType' | 'sizeMode' | 'sizeValue'>>,
  ) {
    setLaps((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)));
    setDirty(true);
  }

  function deleteLap(key: string) {
    setLaps((prev) => prev.filter((l) => l.key !== key));
    setDirty(true);
  }

  // Moves the lap `key` to sit where `beforeKey` currently is — used by the
  // drag handle in LapEditorRow, called continuously while dragging (once
  // per row boundary crossed), not just on drop. Functional update (not a
  // closure over `laps`) is required here: the caller is a pointermove
  // listener set up once per drag session, so a closure captured at drag
  // start would keep reading the pre-drag array on every subsequent move.
  function reorderLap(key: string, beforeKey: string) {
    setLaps((prev) => reorderLaps(prev, key, beforeKey));
    setDirty(true);
  }

  // afterKey null = insert at the very start
  function insertLap(afterKey: string | null, lap: Omit<WorkingLap, 'key'>) {
    setLaps((prev) => {
      const idx =
        afterKey == null ? 0 : prev.findIndex((l) => l.key === afterKey) + 1;
      const next = [...prev];
      next.splice(idx, 0, { ...lap, key: nextKey() });
      return next;
    });
    setDirty(true);
  }

  function insertReps(
    afterKey: string | null,
    count: number,
    workoutSize: Pick<WorkingLap, 'sizeMode' | 'sizeValue'>,
    restSize: Pick<WorkingLap, 'sizeMode' | 'sizeValue'>,
  ) {
    setLaps((prev) => {
      const idx =
        afterKey == null ? 0 : prev.findIndex((l) => l.key === afterKey) + 1;
      const inserted: WorkingLap[] = [];
      for (let i = 0; i < count; i++) {
        inserted.push({ ...workoutSize, lapType: 'WORKOUT', key: nextKey() });
        inserted.push({ ...restSize, lapType: 'REST', key: nextKey() });
      }
      const next = [...prev];
      next.splice(idx, 0, ...inserted);
      return next;
    });
    setDirty(true);
  }

  async function save(): Promise<ActivityDetail> {
    setSaving(true);
    setSaveError(null);
    try {
      const res = await apiFetch(`/activities/${activityId}/laps`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          laps: laps.map((l) => ({
            lapType: l.lapType,
            sizeMode: l.sizeMode,
            sizeValue: l.sizeValue,
          })),
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.message ?? `HTTP ${res.status}`);
      }
      const updated: ActivityDetail = await res.json();
      setDirty(false);
      return updated;
    } catch (err) {
      setSaveError((err as Error).message);
      throw err;
    } finally {
      setSaving(false);
    }
  }

  const canSave =
    !streamLoading &&
    !streamError &&
    laps.length > 0 &&
    progress.isComplete &&
    !saving;

  return {
    laps,
    resolved,
    points: points ?? [],
    streamLoading,
    streamError,
    retryStream: loadStream,
    progress,
    dirty,
    saving,
    saveError,
    canSave,
    updateLap,
    deleteLap,
    reorderLap,
    insertLap,
    insertReps,
    save,
  };
}
