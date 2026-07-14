import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { BestEffortsSyncService } from 'src/strava/best-efforts/best-efforts-sync.service';
import { StravaClientService } from 'src/strava/client/strava-client.service';

const { mockPrisma } = vi.hoisted(() => {
  return {
    mockPrisma: {
      activity: {
        findMany: vi.fn(),
        update:   vi.fn(),
      },
      activityBestEffort: {
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

describe('BestEffortsSyncService', () => {
  let service: BestEffortsSyncService;
  let stravaClient: any;

  beforeEach(async () => {
    vi.clearAllMocks();

    mockPrisma.activity.findMany.mockResolvedValue([]);
    mockPrisma.activity.update.mockResolvedValue({});
    mockPrisma.activityBestEffort.createMany.mockResolvedValue({ count: 0 });
    mockPrisma.$transaction.mockImplementation(async (ops: any[]) =>
      Promise.all(ops),
    );

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BestEffortsSyncService,
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

    service = module.get(BestEffortsSyncService);
    stravaClient = module.get(StravaClientService);

    vi.spyOn(service as any, 'sleep').mockResolvedValue(undefined);
  });

  it('only queries activities with bestEffortsSyncedAt null', async () => {
    await service.backfillBestEfforts(USER_ID);

    expect(mockPrisma.activity.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: USER_ID, bestEffortsSyncedAt: null },
      }),
    );
  });

  it('inserts efforts and marks bestEffortsSyncedAt in the same transaction', async () => {
    mockPrisma.activity.findMany.mockResolvedValueOnce([
      { id: 'act-1', stravaId: 111n },
    ]);
    stravaClient.get.mockResolvedValueOnce({
      id: 111,
      best_efforts: [
        {
          id: 42,
          name: '10k',
          distance: 10000,
          moving_time: 2400,
          elapsed_time: 2410,
          start_date: '2024-03-15T07:00:00Z',
        },
      ],
    });

    const result = await service.backfillBestEfforts(USER_ID);

    expect(result).toEqual({ processed: 1, toProcess: 1 });
    expect(mockPrisma.activityBestEffort.createMany).toHaveBeenCalledWith({
      data: [expect.objectContaining({ id: '42', activityId: 'act-1', name: '10k' })],
    });
    expect(mockPrisma.activity.update).toHaveBeenCalledWith({
      where: { id: 'act-1' },
      data: { bestEffortsSyncedAt: expect.any(Date) },
    });
  });

  it('retries after a rate limit without skipping the activity', async () => {
    mockPrisma.activity.findMany.mockResolvedValueOnce([
      { id: 'act-1', stravaId: 111n },
    ]);
    stravaClient.get
      .mockRejectedValueOnce(new Error('STRAVA_RATE_LIMIT'))
      .mockResolvedValueOnce({ id: 111, best_efforts: [] });

    const result = await service.backfillBestEfforts(USER_ID);

    expect(result).toEqual({ processed: 1, toProcess: 1 });
    expect(stravaClient.get).toHaveBeenCalledTimes(2);
  });

  it('does not start a second backfill while one is already running', async () => {
    let resolveSlow: (value: any) => void;
    const slowPromise = new Promise((resolve) => {
      resolveSlow = resolve;
    });
    mockPrisma.activity.findMany.mockReturnValueOnce(slowPromise as any);

    const first = service.backfillBestEfforts(USER_ID);
    const second = await service.backfillBestEfforts(USER_ID);

    expect(second).toEqual({ processed: 0, toProcess: 0 });

    resolveSlow!([]);
    await first;
  });
});
