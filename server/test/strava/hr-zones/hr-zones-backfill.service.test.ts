import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { HrZonesBackfillService } from 'src/strava/hr-zones/hr-zones-backfill.service';
import { StravaClientService } from 'src/strava/client/strava-client.service';

const { mockPrisma } = vi.hoisted(() => {
  return {
    mockPrisma: {
      activity: {
        findMany: vi.fn(),
        update:   vi.fn(),
      },
      activityHrZoneTime: {
        createMany: vi.fn(),
      },
      $transaction: vi.fn(),
      $disconnect:  vi.fn(),
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

describe('HrZonesBackfillService', () => {
  let service: HrZonesBackfillService;
  let stravaClient: any;

  beforeEach(async () => {
    vi.clearAllMocks();

    mockPrisma.activity.findMany.mockResolvedValue([]);
    mockPrisma.activity.update.mockResolvedValue({});
    mockPrisma.activityHrZoneTime.createMany.mockResolvedValue({ count: 0 });
    mockPrisma.$transaction.mockImplementation(async (ops: any[]) =>
      Promise.all(ops),
    );

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        HrZonesBackfillService,
        {
          provide: StravaClientService,
          useValue: { get: vi.fn() },
        },
        {
          provide: ConfigService,
          useValue: {
            get: vi.fn((key: string) => {
              if (key === 'DATABASE_URL') return 'postgresql://test';
              return undefined;
            }),
          },
        },
      ],
    }).compile();

    service = module.get(HrZonesBackfillService);
    stravaClient = module.get(StravaClientService);

    vi.spyOn(service as any, 'sleep').mockResolvedValue(undefined);
  });

  it('only queries activities with hrZonesSyncedAt null', async () => {
    await service.backfillHrZones(USER_ID);

    expect(mockPrisma.activity.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: USER_ID, hrZonesSyncedAt: null },
      }),
    );
  });

  it('inserts zone rows and marks hrZonesSyncedAt in the same transaction', async () => {
    mockPrisma.activity.findMany.mockResolvedValueOnce([
      { id: 'act-1', stravaId: 111n },
    ]);
    stravaClient.get.mockResolvedValueOnce([
      {
        type: 'heartrate',
        distribution_buckets: [
          { min: 0, max: 115, time: 120 },
          { min: 115, max: 145, time: 900 },
        ],
      },
    ]);

    const result = await service.backfillHrZones(USER_ID);

    expect(result).toEqual({ processed: 1, toProcess: 1 });
    expect(mockPrisma.activityHrZoneTime.createMany).toHaveBeenCalledWith({
      data: [
        { activityId: 'act-1', zoneIndex: 0, min: 0, max: 115, timeSec: 120 },
        { activityId: 'act-1', zoneIndex: 1, min: 115, max: 145, timeSec: 900 },
      ],
    });
    expect(mockPrisma.activity.update).toHaveBeenCalledWith({
      where: { id: 'act-1' },
      data: { hrZonesSyncedAt: expect.any(Date) },
    });
  });

  it('marks hrZonesSyncedAt with zero rows created when Strava returns no zone data (non-premium account)', async () => {
    mockPrisma.activity.findMany.mockResolvedValueOnce([
      { id: 'act-1', stravaId: 111n },
    ]);
    stravaClient.get.mockResolvedValueOnce([]);

    const result = await service.backfillHrZones(USER_ID);

    expect(result).toEqual({ processed: 1, toProcess: 1 });
    expect(mockPrisma.activityHrZoneTime.createMany).not.toHaveBeenCalled();
    expect(mockPrisma.activity.update).toHaveBeenCalledWith({
      where: { id: 'act-1' },
      data: { hrZonesSyncedAt: expect.any(Date) },
    });
  });

  it('retries after a rate limit without skipping the activity', async () => {
    mockPrisma.activity.findMany.mockResolvedValueOnce([
      { id: 'act-1', stravaId: 111n },
    ]);
    stravaClient.get
      .mockRejectedValueOnce(new Error('STRAVA_RATE_LIMIT'))
      .mockResolvedValueOnce([]);

    const result = await service.backfillHrZones(USER_ID);

    expect(result).toEqual({ processed: 1, toProcess: 1 });
    expect(stravaClient.get).toHaveBeenCalledTimes(2);
  });

  it('does not start a second backfill while one is already running', async () => {
    let resolveSlow: (value: any) => void;
    const slowPromise = new Promise((resolve) => {
      resolveSlow = resolve;
    });
    mockPrisma.activity.findMany.mockReturnValueOnce(slowPromise as any);

    const first = service.backfillHrZones(USER_ID);
    const second = await service.backfillHrZones(USER_ID);

    expect(second).toEqual({ processed: 0, toProcess: 0 });

    resolveSlow!([]);
    await first;
  });
});
