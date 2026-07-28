import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// Pins the actual guarantee behind "deleting a template doesn't delete past
// workouts": it lives in the FK constraint (ON DELETE SET NULL), not in
// application code — WorkoutTemplatesService.remove() only ever calls
// prisma.workoutTemplate.delete() (see workout-templates.service.test.ts).
// This test fails loudly if the constraint is ever changed to CASCADE.
describe('workout templates migration', () => {
  it('workouts.template_id FK is ON DELETE SET NULL, not CASCADE', () => {
    const sql = readFileSync(
      join(
        __dirname,
        '../../prisma/migrations/20260720183148_add_workout_templates/migration.sql',
      ),
      'utf-8',
    );

    expect(sql).toMatch(
      /ALTER TABLE "workouts" ADD CONSTRAINT "workouts_template_id_fkey"[^;]*ON DELETE SET NULL/,
    );
  });
});
