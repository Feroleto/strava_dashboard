import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { FoodLogsService } from 'src/food-logs/food-logs.service';

const { mockPrisma } = vi.hoisted(() => {
  return {
    mockPrisma: {
      $queryRaw: vi.fn(),
      foodLog: {
        create: vi.fn(),
        findMany: vi.fn(),
        deleteMany: vi.fn(),
      },
    },
  };
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

describe('FoodLogsService', () => {
  let service: FoodLogsService;

  beforeEach(async () => {
    vi.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FoodLogsService,
        {
          provide: ConfigService,
          useValue: { get: vi.fn(() => 'postgresql://test') },
        },
      ],
    }).compile();

    service = module.get(FoodLogsService);
  });

  describe('create', () => {
    it('creates a log scoped to the authenticated user', async () => {
      mockPrisma.foodLog.create.mockResolvedValueOnce({ id: 'log1' });

      await service.create(USER_ID, {
        foodId: 'food1',
        quantity: 150,
        mealType: 'LUNCH' as any,
        loggedAt: new Date('2026-07-29T12:00:00.000Z'),
      });

      const data = mockPrisma.foodLog.create.mock.calls[0][0].data;
      expect(data.userId).toBe(USER_ID);
      expect(data.foodId).toBe('food1');
      expect(data.quantity).toBe(150);
      expect(data.mealType).toBe('LUNCH');
    });
  });

  describe('findByDate', () => {
    it('scopes to the user and the UTC day boundary for the given date', async () => {
      mockPrisma.foodLog.findMany.mockResolvedValueOnce([]);

      await service.findByDate(USER_ID, '2026-07-29');

      const where = mockPrisma.foodLog.findMany.mock.calls[0][0].where;
      expect(where.userId).toBe(USER_ID);
      expect(where.loggedAt.gte).toEqual(new Date('2026-07-29T00:00:00.000Z'));
      expect(where.loggedAt.lt).toEqual(new Date('2026-07-30T00:00:00.000Z'));
    });
  });

  describe('remove', () => {
    it('deletes scoped by id and userId together (404-not-403 convention)', async () => {
      mockPrisma.foodLog.deleteMany.mockResolvedValueOnce({ count: 1 });

      await service.remove(USER_ID, 'log1');

      expect(mockPrisma.foodLog.deleteMany).toHaveBeenCalledWith({
        where: { id: 'log1', userId: USER_ID },
      });
    });

    it('throws NotFoundException when nothing matched (not owned, or does not exist)', async () => {
      mockPrisma.foodLog.deleteMany.mockResolvedValueOnce({ count: 0 });

      await expect(service.remove(USER_ID, 'log1')).rejects.toThrow();
    });
  });

  describe('getDailySummary', () => {
    it('returns the summed macros from $queryRaw', async () => {
      const row = { totalKcal: 900, totalProtein: 40, totalCarbs: 100, totalFat: 30 };
      mockPrisma.$queryRaw.mockResolvedValueOnce([row]);

      const result = await service.getDailySummary(USER_ID, '2026-07-29');

      expect(result).toEqual(row);
      expect(mockPrisma.$queryRaw).toHaveBeenCalledTimes(1);
    });

    it('returns all-zero totals when there are no logs for the day', async () => {
      mockPrisma.$queryRaw.mockResolvedValueOnce([]);

      const result = await service.getDailySummary(USER_ID, '2026-07-29');

      expect(result).toEqual({ totalKcal: 0, totalProtein: 0, totalCarbs: 0, totalFat: 0 });
    });
  });

  describe('getHistory', () => {
    it('formats each row date to YYYY-MM-DD and passes through the totals', async () => {
      mockPrisma.$queryRaw.mockResolvedValueOnce([
        {
          date: new Date('2026-07-29T00:00:00.000Z'),
          totalKcal: 1800,
          totalProtein: 120,
          totalCarbs: 200,
          totalFat: 60,
        },
      ]);

      const result = await service.getHistory(USER_ID, 7);

      expect(result).toEqual([
        { date: '2026-07-29', totalKcal: 1800, totalProtein: 120, totalCarbs: 200, totalFat: 60 },
      ]);
      expect(mockPrisma.$queryRaw).toHaveBeenCalledTimes(1);
    });

    it('returns an empty array when generate_series produces no rows (defensive)', async () => {
      mockPrisma.$queryRaw.mockResolvedValueOnce([]);

      const result = await service.getHistory(USER_ID, 14);

      expect(result).toEqual([]);
    });
  });
});
