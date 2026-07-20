import type { LapType } from '@/lib/types';

// ACTIVITY is a detector-only fallback label (no distinct effort found) —
// never offered as a choice for manually edited/created laps, same rule as
// the backend's EDITABLE_LAP_TYPES (server/src/activities/lap-editor/dto.ts)
export const EDITABLE_LAP_TYPES: LapType[] = [
  'RUN',
  'WORKOUT',
  'REST',
  'STEADY',
  'WARMUP',
  'COOLDOWN',
];

export const LAP_TYPE_I18N: Record<LapType, string> = {
  RUN: 'lapType.run',
  WORKOUT: 'lapType.workout',
  REST: 'lapType.rest',
  STEADY: 'lapType.steady',
  WARMUP: 'lapType.warmup',
  COOLDOWN: 'lapType.cooldown',
  ACTIVITY: 'lapType.activity',
};
