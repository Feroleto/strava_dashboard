import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { PersonalBestsService } from 'src/personal-bests/personal-bests.service';

const { mockPrisma } = vi.hoisted(() => {
  return {
    mockPrisma: {
      $queryRaw: vi.fn(),
      activityBestEffort: {
        findMany: vi.fn(),
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

describe('PersonalBestsService', () => {
  let service: PersonalBestsService;

  beforeEach(async () => {
    vi.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PersonalBestsService,
        {
          provide: ConfigService,
          useValue: { get: vi.fn(() => 'postgresql://test') },
        },
      ],
    }).compile();

    service = module.get(PersonalBestsService);
  });

  describe('topRecords', () => {
    it('returns the rows from $queryRaw', async () => {
      const rows = [
        {
          name: '5K',
          rank: 1,
          movingTime: 1200,
          distance: 5000,
          startDate: new Date('2024-03-15'),
          activityId: 'act-1',
          prRank: 1,
        },
        {
          name: '5K',
          rank: 2,
          movingTime: 1260,
          distance: 5000,
          startDate: new Date('2024-02-10'),
          activityId: 'act-2',
          prRank: null,
        },
      ];
      mockPrisma.$queryRaw.mockResolvedValueOnce(rows);

      const result = await service.topRecords(USER_ID);

      expect(result).toEqual(rows);
      expect(mockPrisma.$queryRaw).toHaveBeenCalledTimes(1);
    });
  });

  describe('history', () => {
    it('queries efforts scoped by name and the activity owner', async () => {
      mockPrisma.activityBestEffort.findMany.mockResolvedValueOnce([]);

      await service.history(USER_ID, '5k');

      expect(mockPrisma.activityBestEffort.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { name: '5k', activity: { userId: USER_ID } },
          orderBy: { startDate: 'asc' },
        }),
      );
    });
  });
});
