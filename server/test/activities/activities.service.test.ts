import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { ActivitiesService } from 'src/activities/activities.service';

const { mockPrisma } = vi.hoisted(() => {
  return {
    mockPrisma: {
      activityHrZoneTime: {
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
    WorkoutType: {
      EASY_OR_LONG: 'EASY_OR_LONG',
      INTERVAL: 'INTERVAL',
      HILL_REPEATS: 'HILL_REPEATS',
    },
  };
});

vi.mock('@prisma/adapter-pg', () => {
  return {
    PrismaPg: class {},
  };
});

const USER_ID = 'user_test_123';

describe('ActivitiesService', () => {
  let service: ActivitiesService;

  beforeEach(async () => {
    vi.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ActivitiesService,
        {
          provide: ConfigService,
          useValue: { get: vi.fn(() => 'postgresql://test') },
        },
      ],
    }).compile();

    service = module.get(ActivitiesService);
  });

  describe('listHrZonesForAnalysis', () => {
    it('flattens activityHrZoneTime rows with the activity start date hoisted up', async () => {
      mockPrisma.activityHrZoneTime.findMany.mockResolvedValueOnce([
        {
          zoneIndex: 0,
          min: 0,
          max: 115,
          timeSec: 120,
          activity: { id: 'act-1', startDate: new Date('2026-03-15T07:00:00Z') },
        },
        {
          zoneIndex: 1,
          min: 115,
          max: 145,
          timeSec: 900,
          activity: { id: 'act-1', startDate: new Date('2026-03-15T07:00:00Z') },
        },
      ]);

      const result = await service.listHrZonesForAnalysis(USER_ID);

      expect(result).toEqual({
        items: [
          {
            activityId: 'act-1',
            activityStartDate: new Date('2026-03-15T07:00:00Z'),
            zoneIndex: 0,
            min: 0,
            max: 115,
            timeSec: 120,
          },
          {
            activityId: 'act-1',
            activityStartDate: new Date('2026-03-15T07:00:00Z'),
            zoneIndex: 1,
            min: 115,
            max: 145,
            timeSec: 900,
          },
        ],
      });
      expect(mockPrisma.activityHrZoneTime.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { activity: { userId: USER_ID } } }),
      );
    });

    it('returns an empty items array when there is no zone data', async () => {
      mockPrisma.activityHrZoneTime.findMany.mockResolvedValueOnce([]);

      const result = await service.listHrZonesForAnalysis(USER_ID);

      expect(result).toEqual({ items: [] });
    });
  });
});
