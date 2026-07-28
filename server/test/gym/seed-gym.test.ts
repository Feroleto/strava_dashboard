import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  slugify,
  mapEnum,
  mapMuscles,
  seedExercises,
  type RawExercise,
} from '../../prisma/seed-gym';

describe('seed-gym', () => {
  describe('slugify', () => {
    it('kebab-cases mixed separators and casing', () => {
      expect(slugify('3_4_Sit-Up')).toBe('3-4-sit-up');
    });

    it('strips leading/trailing separators', () => {
      expect(slugify('__Leg Press__')).toBe('leg-press');
    });
  });

  describe('mapEnum', () => {
    const map = { push: 'PUSH', pull: 'PULL' } as const;

    it('maps known values case-insensitively', () => {
      expect(mapEnum(map, 'Push', 'force', 'Bench Press')).toBe('PUSH');
    });

    it('returns undefined and warns for unmapped values instead of throwing', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      expect(mapEnum(map, 'unknown', 'force', 'Mystery Move')).toBeUndefined();
      expect(warn).toHaveBeenCalledOnce();
      warn.mockRestore();
    });

    it('returns undefined for null/undefined input without warning', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      expect(mapEnum(map, null, 'force', 'x')).toBeUndefined();
      expect(mapEnum(map, undefined, 'force', 'x')).toBeUndefined();
      expect(warn).not.toHaveBeenCalled();
      warn.mockRestore();
    });
  });

  describe('mapMuscles', () => {
    it('maps the dataset-only "middle back" value to BACK', () => {
      expect(mapMuscles(['middle back'], 'Deadlift')).toEqual(['BACK']);
    });

    it('drops unmapped entries rather than failing the whole exercise', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      expect(mapMuscles(['chest', 'bogus'], 'x')).toEqual(['CHEST']);
      warn.mockRestore();
    });
  });

  describe('seedExercises', () => {
    const raw: RawExercise = {
      id: 'Bench_Press',
      name: 'Bench Press',
      force: 'push',
      level: 'intermediate',
      mechanic: 'compound',
      equipment: 'barbell',
      primaryMuscles: ['chest'],
      secondaryMuscles: ['triceps'],
      instructions: ['Lie down.'],
      images: ['a.jpg'],
      category: 'strength',
    };

    let upsert: ReturnType<typeof vi.fn>;
    let prisma: Parameters<typeof seedExercises>[0];

    beforeEach(() => {
      upsert = vi.fn().mockResolvedValue({});
      prisma = { exercise: { upsert } } as unknown as Parameters<typeof seedExercises>[0];
    });

    it('upserts by slug, never inserts twice for the same input', async () => {
      const count1 = await seedExercises(prisma, [raw]);
      const count2 = await seedExercises(prisma, [raw]);

      expect(count1).toBe(1);
      expect(count2).toBe(1);
      expect(upsert).toHaveBeenCalledTimes(2);
      // both calls target the exact same slug — re-running never creates a
      // second row, only updates the existing one
      expect(upsert.mock.calls[0][0].where).toEqual({ slug: 'bench-press' });
      expect(upsert.mock.calls[1][0].where).toEqual({ slug: 'bench-press' });
    });

    it('sets source SEED only on create, never touches it on update', async () => {
      await seedExercises(prisma, [raw]);

      const args = upsert.mock.calls[0][0];
      expect(args.create.source).toBe('SEED');
      expect(args.update.source).toBeUndefined();
    });
  });
});
