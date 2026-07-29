import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// Pins the guarantee behind "deleting a user wipes their outstanding reset
// tokens too": it lives in the FK constraint (ON DELETE CASCADE), matching
// every other FK hung directly off User (StravaAccount, Gear, Workout, ...).
// This test fails loudly if the constraint is ever loosened.
describe('password reset token migration', () => {
  it('password_reset_tokens.user_id FK is ON DELETE CASCADE', () => {
    const sql = readFileSync(
      join(
        __dirname,
        '../../prisma/migrations/20260729005102_add_password_reset_token/migration.sql',
      ),
      'utf-8',
    );

    expect(sql).toMatch(
      /ALTER TABLE "password_reset_tokens" ADD CONSTRAINT "password_reset_tokens_user_id_fkey"[^;]*ON DELETE CASCADE/,
    );
  });
});
