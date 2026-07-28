import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { ExercisesService } from 'src/exercises/exercises.service';

const { mockPrisma } = vi.hoisted(() => {
  return {
    mockPrisma: {
      exercise: {
        findMany: vi.fn(),
        count: vi.fn(),
        findFirst: vi.fn(),
        findUnique: vi.fn(),
        create: vi.fn(),
      },
      workoutExercise: {
        findFirst: vi.fn(),
      },
      workoutSet: {
        findFirst: vi.fn(),
      },
    },
  };
});

vi.mock('@prisma/client', () => {
  return {
    PrismaClient: vi.fn().mockImplementation(function (this: any) {
      return mockPrisma;
    }),
  };
});

vi.mock('@prisma/adapter-pg', () => {
  return {
    PrismaPg: class {},
  };
});

const USER_ID = 'user_test_123';
const OTHER_USER_ID = 'user_other_456';

describe('ExercisesService', () => {
  let service: ExercisesService;

  beforeEach(async () => {
    vi.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ExercisesService,
        {
          provide: ConfigService,
          useValue: { get: vi.fn(() => 'postgresql://test') },
        },
      ],
    }).compile();

    service = module.get(ExercisesService);
  });

  describe('list', () => {
    it('scopes results to global SEED exercises plus the caller-owned USER ones', async () => {
      mockPrisma.exercise.findMany.mockResolvedValueOnce([]);
      mockPrisma.exercise.count.mockResolvedValueOnce(0);

      await service.list(USER_ID, 1, 20, {}, 'en');

      const where = mockPrisma.exercise.findMany.mock.calls[0][0].where;
      expect(where.AND[0]).toEqual({
        OR: [{ source: 'SEED' }, { source: 'USER', createdByUserId: USER_ID }],
      });
    });

    it('applies search/muscle/equipment filters when provided', async () => {
      mockPrisma.exercise.findMany.mockResolvedValueOnce([]);
      mockPrisma.exercise.count.mockResolvedValueOnce(0);

      await service.list(
        USER_ID,
        1,
        20,
        {
          search: 'press',
          muscle: 'CHEST' as any,
          equipment: 'BARBELL' as any,
        },
        'en',
      );

      const where = mockPrisma.exercise.findMany.mock.calls[0][0].where;
      expect(where.AND).toContainEqual({
        OR: [
          { name: { contains: 'press', mode: 'insensitive' } },
          { namePt: { contains: 'press', mode: 'insensitive' } },
        ],
      });
      expect(where.AND).toContainEqual({ primaryMuscles: { has: 'CHEST' } });
      expect(where.AND).toContainEqual({ equipment: 'BARBELL' });
    });

    it('applies the muscles OR filter (hasSome) for the coarse mobile group chips', async () => {
      mockPrisma.exercise.findMany.mockResolvedValueOnce([]);
      mockPrisma.exercise.count.mockResolvedValueOnce(0);

      await service.list(
        USER_ID,
        1,
        20,
        {
          muscles: ['BACK', 'LATS', 'TRAPS'] as any,
        },
        'en',
      );

      const where = mockPrisma.exercise.findMany.mock.calls[0][0].where;
      expect(where.AND).toContainEqual({
        primaryMuscles: { hasSome: ['BACK', 'LATS', 'TRAPS'] },
      });
    });

    it('omits the muscles filter entirely when the array is empty', async () => {
      mockPrisma.exercise.findMany.mockResolvedValueOnce([]);
      mockPrisma.exercise.count.mockResolvedValueOnce(0);

      await service.list(USER_ID, 1, 20, { muscles: [] }, 'en');

      const where = mockPrisma.exercise.findMany.mock.calls[0][0].where;
      expect(where.AND).toContainEqual({});
      expect(where.AND).not.toContainEqual(
        expect.objectContaining({ primaryMuscles: expect.anything() }),
      );
    });
  });

  describe('findById', () => {
    it('returns null for a custom exercise owned by a different user', async () => {
      // the mock is a stand-in for the DB honoring the visibility where — a
      // real Postgres query with createdByUserId != USER_ID would also
      // exclude this row
      mockPrisma.exercise.findFirst.mockResolvedValueOnce(null);

      const result = await service.findById(USER_ID, 'ex_owned_by_other', 'en');

      expect(result).toBeNull();
      const where = mockPrisma.exercise.findFirst.mock.calls[0][0].where;
      expect(where.OR).toEqual([
        { source: 'SEED' },
        { source: 'USER', createdByUserId: USER_ID },
      ]);
    });
  });

  describe('create', () => {
    it('always sets source USER and createdByUserId from the authenticated caller', async () => {
      mockPrisma.exercise.findUnique.mockResolvedValueOnce(null);
      mockPrisma.exercise.create.mockResolvedValueOnce({ id: 'ex1' });

      await service.create(USER_ID, {
        name: 'My Custom Curl',
        primaryMuscles: [],
        secondaryMuscles: [],
        instructions: [],
        imageUrls: [],
      });

      const data = mockPrisma.exercise.create.mock.calls[0][0].data;
      expect(data.source).toBe('USER');
      expect(data.createdByUserId).toBe(USER_ID);
    });

    it('appends a numeric suffix when the slug already exists', async () => {
      mockPrisma.exercise.findUnique
        .mockResolvedValueOnce({ id: 'existing' }) // 'my-curl' taken
        .mockResolvedValueOnce(null); // 'my-curl-2' free
      mockPrisma.exercise.create.mockResolvedValueOnce({ id: 'ex2' });

      await service.create(OTHER_USER_ID, {
        name: 'My Curl',
        primaryMuscles: [],
        secondaryMuscles: [],
        instructions: [],
        imageUrls: [],
      });

      const data = mockPrisma.exercise.create.mock.calls[0][0].data;
      expect(data.slug).toBe('my-curl-2');
    });
  });

  describe('lastPerformance', () => {
    it('returns null when the user has never logged this exercise', async () => {
      mockPrisma.workoutExercise.findFirst.mockResolvedValueOnce(null);

      const result = await service.lastPerformance(USER_ID, 'ex1');

      expect(result).toBeNull();
    });

    it('converts Decimal-like weightKg/rpe to numbers and preserves null', async () => {
      mockPrisma.workoutExercise.findFirst.mockResolvedValueOnce({
        workoutId: 'w1',
        workout: { startedAt: new Date('2026-07-01T00:00:00Z') },
        sets: [
          { id: 's1', setNumber: 1, weightKg: 82.5, reps: 8, rpe: 8, setType: 'WORKING' },
          { id: 's2', setNumber: 2, weightKg: null, reps: 6, rpe: null, setType: 'DROPSET' },
        ],
      });

      const result = await service.lastPerformance(USER_ID, 'ex1');

      expect(result?.sets).toEqual([
        { id: 's1', setNumber: 1, weightKg: 82.5, reps: 8, rpe: 8, setType: 'WORKING' },
        { id: 's2', setNumber: 2, weightKg: null, reps: 6, rpe: null, setType: 'DROPSET' },
      ]);
    });
  });

  describe('personalRecord', () => {
    it('returns null when the user has never logged a weighted set for this exercise', async () => {
      mockPrisma.workoutSet.findFirst.mockResolvedValueOnce(null);

      const result = await service.personalRecord(USER_ID, 'ex1');

      expect(result).toBeNull();
    });

    it('scopes the query to the caller\'s own finished workouts, ranked by weight then reps then recency', async () => {
      mockPrisma.workoutSet.findFirst.mockResolvedValueOnce(null);

      await service.personalRecord(USER_ID, 'ex1');

      const call = mockPrisma.workoutSet.findFirst.mock.calls[0][0];
      expect(call.where).toEqual({
        weightKg: { not: null },
        workoutExercise: {
          exerciseId: 'ex1',
          workout: { userId: USER_ID, finishedAt: { not: null } },
        },
      });
      expect(call.orderBy).toEqual([
        { weightKg: 'desc' },
        { reps: 'desc' },
        { completedAt: 'desc' },
      ]);
    });

    it('converts Decimal-like weightKg to a number and surfaces the workout it happened in', async () => {
      mockPrisma.workoutSet.findFirst.mockResolvedValueOnce({
        weightKg: 100,
        reps: 5,
        workoutExercise: {
          workout: {
            id: 'w1',
            startedAt: new Date('2026-07-20T00:00:00Z'),
            template: { name: 'Upper' },
          },
        },
      });

      const result = await service.personalRecord(USER_ID, 'ex1');

      expect(result).toEqual({
        weightKg: 100,
        reps: 5,
        workoutId: 'w1',
        startedAt: new Date('2026-07-20T00:00:00Z'),
        templateName: 'Upper',
      });
    });

    it('reports templateName null for a free workout (no routine)', async () => {
      mockPrisma.workoutSet.findFirst.mockResolvedValueOnce({
        weightKg: 60,
        reps: 10,
        workoutExercise: {
          workout: {
            id: 'w2',
            startedAt: new Date('2026-07-21T00:00:00Z'),
            template: null,
          },
        },
      });

      const result = await service.personalRecord(USER_ID, 'ex1');

      expect(result?.templateName).toBeNull();
    });
  });
});
