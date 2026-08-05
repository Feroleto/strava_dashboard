import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const sql = readFileSync(
  join(__dirname, '../../prisma/migrations/20260804234814_add_meals/migration.sql'),
  'utf-8',
);

describe('meals migration', () => {
  // The counterpart of workout-templates-migration.test.ts, pinning the
  // OPPOSITE choice: deleting a meal is meant to take its food logs with it,
  // on every day, behind an explicit confirmation in the UI. If this ever
  // flips to SET NULL the column is NOT NULL and deletes would start failing.
  it('food_logs.meal_id FK is ON DELETE CASCADE, not SET NULL', () => {
    expect(sql).toMatch(
      /ALTER TABLE "food_logs" ADD CONSTRAINT "food_logs_meal_id_fkey"[^;]*ON DELETE CASCADE/,
    );
  });

  // This is a data migration: the order of the steps is the whole correctness
  // argument. Backfill has to run while meal_type still exists and before the
  // column is made NOT NULL, otherwise existing logs are lost or the migration
  // aborts. A future edit reordering these would be silently destructive.
  it('backfills before enforcing NOT NULL and before dropping meal_type', () => {
    const backfill = sql.indexOf('UPDATE "food_logs"');
    const notNull = sql.indexOf('SET NOT NULL');
    const dropColumn = sql.indexOf('DROP COLUMN "meal_type"');

    expect(backfill).toBeGreaterThan(-1);
    expect(notNull).toBeGreaterThan(backfill);
    expect(dropColumn).toBeGreaterThan(notNull);
  });

  // Every user must get all five default slots, or the backfill above leaves
  // some logs unmatched — which SET NOT NULL then turns into a failed
  // migration rather than silent data loss, but a failed one either way.
  it('seeds the five default meals for every existing user', () => {
    expect(sql).toMatch(/INSERT INTO "meals"[\s\S]*FROM "users" u[\s\S]*CROSS JOIN/);
    for (const type of ['BREAKFAST', 'LUNCH', 'SNACK', 'DINNER', 'SUPPER']) {
      expect(sql).toContain(`'${type}'::"meal_type"`);
    }
  });
});
