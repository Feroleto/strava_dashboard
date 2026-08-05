import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { MealsService } from 'src/meals/meals.service';

const { mockPrisma } = vi.hoisted(() => {
  const prisma: any = {
    meal: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
      createMany: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    $executeRaw: vi.fn(),
    // both shapes: the array form for reorder (same convention as
    // workout-templates.service.test.ts) and the interactive callback form
    // ensureDefaults uses for its advisory lock
    $transaction: vi.fn((arg: unknown) =>
      typeof arg === 'function' ? (arg as (tx: unknown) => unknown)(prisma) : Promise.all(arg as unknown[]),
    ),
  };
  return { mockPrisma: prisma };
});

vi.mock('@prisma/client', () => {
  return {
    Prisma: {},
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

function row(id: string, type: string, order: number, logs = 0) {
  return { id, type, order, _count: { foodLogs: logs } };
}

describe('MealsService', () => {
  let service: MealsService;

  beforeEach(async () => {
    vi.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MealsService,
        {
          provide: ConfigService,
          useValue: { get: vi.fn(() => 'postgresql://test') },
        },
      ],
    }).compile();

    service = module.get(MealsService);
  });

  describe('list', () => {
    it('flattens _count.foodLogs into logCount', async () => {
      mockPrisma.meal.findMany.mockResolvedValueOnce([row('m1', 'BREAKFAST', 1, 7)]);

      const result = await service.list(USER_ID);

      expect(result).toEqual([{ id: 'm1', type: 'BREAKFAST', order: 1, logCount: 7 }]);
      expect(mockPrisma.meal.createMany).not.toHaveBeenCalled();
    });

    it('seeds the five defaults in display order for a user with none', async () => {
      mockPrisma.meal.findMany.mockResolvedValueOnce([]);
      mockPrisma.meal.count.mockResolvedValueOnce(0);
      mockPrisma.meal.findMany.mockResolvedValueOnce([row('m1', 'BREAKFAST', 1)]);

      await service.list(USER_ID);

      expect(mockPrisma.meal.createMany).toHaveBeenCalledTimes(1);
      expect(mockPrisma.meal.createMany.mock.calls[0][0].data).toEqual([
        { userId: USER_ID, type: 'BREAKFAST', order: 1 },
        { userId: USER_ID, type: 'LUNCH', order: 2 },
        { userId: USER_ID, type: 'SNACK', order: 3 },
        { userId: USER_ID, type: 'DINNER', order: 4 },
        { userId: USER_ID, type: 'SUPPER', order: 5 },
      ]);
    });

    // the advisory lock is only useful if the re-check inside it is honoured:
    // the loser of the race must find rows and bail out
    it('does not seed when another caller won the lock and already seeded', async () => {
      mockPrisma.meal.findMany.mockResolvedValueOnce([]);
      mockPrisma.meal.count.mockResolvedValueOnce(5);
      mockPrisma.meal.findMany.mockResolvedValueOnce([row('m1', 'BREAKFAST', 1)]);

      await service.list(USER_ID);

      expect(mockPrisma.$executeRaw).toHaveBeenCalledTimes(1);
      expect(mockPrisma.meal.createMany).not.toHaveBeenCalled();
    });
  });

  describe('create', () => {
    it('appends after the highest existing order', async () => {
      mockPrisma.meal.findMany.mockResolvedValueOnce([{ order: 1 }, { order: 4 }, { order: 2 }]);
      mockPrisma.meal.findMany.mockResolvedValueOnce([]);

      await service.create(USER_ID, { type: 'SNACK' as any });

      expect(mockPrisma.meal.create).toHaveBeenCalledWith({
        data: { userId: USER_ID, type: 'SNACK', order: 5 },
      });
    });

    it('starts at 1 when the user has no meals', async () => {
      mockPrisma.meal.findMany.mockResolvedValueOnce([]);
      mockPrisma.meal.findMany.mockResolvedValueOnce([]);

      await service.create(USER_ID, { type: 'LUNCH' as any });

      expect(mockPrisma.meal.create.mock.calls[0][0].data.order).toBe(1);
    });

    it('refuses to go past the cap', async () => {
      mockPrisma.meal.findMany.mockResolvedValueOnce(
        Array.from({ length: 12 }, (_, i) => ({ order: i + 1 })),
      );

      await expect(service.create(USER_ID, { type: 'SNACK' as any })).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(mockPrisma.meal.create).not.toHaveBeenCalled();
    });
  });

  describe('update', () => {
    it('renames a meal it owns and returns the full refreshed list', async () => {
      mockPrisma.meal.findFirst.mockResolvedValueOnce({ id: 'm1' });
      mockPrisma.meal.findMany.mockResolvedValueOnce([row('m1', 'DINNER', 1)]);

      const result = await service.update(USER_ID, 'm1', { type: 'DINNER' as any });

      expect(mockPrisma.meal.update).toHaveBeenCalledWith({
        where: { id: 'm1' },
        data: { type: 'DINNER' },
      });
      expect(result).toEqual([{ id: 'm1', type: 'DINNER', order: 1, logCount: 0 }]);
    });

    it('404s for another user’s meal, without writing', async () => {
      mockPrisma.meal.findFirst.mockResolvedValueOnce(null);

      await expect(
        service.update(USER_ID, 'm1', { type: 'DINNER' as any }),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(mockPrisma.meal.update).not.toHaveBeenCalled();
    });
  });

  describe('reorder', () => {
    it('assigns order from array position, 1-based', async () => {
      mockPrisma.meal.findMany.mockResolvedValueOnce([{ id: 'a' }, { id: 'b' }, { id: 'c' }]);
      mockPrisma.meal.findMany.mockResolvedValueOnce([]);

      await service.reorder(USER_ID, { ids: ['c', 'a', 'b'] });

      expect(mockPrisma.meal.update.mock.calls.map((c: any) => c[0])).toEqual([
        { where: { id: 'c' }, data: { order: 1 } },
        { where: { id: 'a' }, data: { order: 2 } },
        { where: { id: 'b' }, data: { order: 3 } },
      ]);
      expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
    });

    // a partial list would renumber some meals on top of others
    it('rejects an id set that is not exactly the user’s current meals', async () => {
      mockPrisma.meal.findMany.mockResolvedValue([{ id: 'a' }, { id: 'b' }, { id: 'c' }]);

      await expect(service.reorder(USER_ID, { ids: ['a', 'b'] })).rejects.toBeInstanceOf(
        BadRequestException,
      );
      await expect(
        service.reorder(USER_ID, { ids: ['a', 'b', 'someone_elses'] }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(mockPrisma.meal.update).not.toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    it('deletes a meal it owns', async () => {
      mockPrisma.meal.findFirst.mockResolvedValueOnce({ id: 'm1' });
      mockPrisma.meal.count.mockResolvedValueOnce(3);
      mockPrisma.meal.findMany.mockResolvedValueOnce([]);

      await service.remove(USER_ID, 'm1');

      expect(mockPrisma.meal.delete).toHaveBeenCalledWith({ where: { id: 'm1' } });
    });

    // without this the lazy-create in list() would resurrect the five defaults
    // for someone who deliberately emptied the list
    it('refuses to delete the last remaining meal', async () => {
      mockPrisma.meal.findFirst.mockResolvedValueOnce({ id: 'm1' });
      mockPrisma.meal.count.mockResolvedValueOnce(1);

      await expect(service.remove(USER_ID, 'm1')).rejects.toBeInstanceOf(BadRequestException);
      expect(mockPrisma.meal.delete).not.toHaveBeenCalled();
    });

    it('404s for another user’s meal, without counting or deleting', async () => {
      mockPrisma.meal.findFirst.mockResolvedValueOnce(null);

      await expect(service.remove(USER_ID, 'm1')).rejects.toBeInstanceOf(NotFoundException);
      expect(mockPrisma.meal.delete).not.toHaveBeenCalled();
    });
  });

  describe('assertOwned', () => {
    it('resolves for a meal the user owns', async () => {
      mockPrisma.meal.findFirst.mockResolvedValueOnce({ id: 'm1' });

      await expect(service.assertOwned(USER_ID, 'm1')).resolves.toBeUndefined();
      expect(mockPrisma.meal.findFirst).toHaveBeenCalledWith({
        where: { id: 'm1', userId: USER_ID },
        select: { id: true },
      });
    });

    it('404s rather than 403s for someone else’s meal', async () => {
      mockPrisma.meal.findFirst.mockResolvedValueOnce(null);

      await expect(service.assertOwned(USER_ID, 'm1')).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});
