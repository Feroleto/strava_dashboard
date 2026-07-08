import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { StravaSyncService } from 'src/strava/sync/strava-sync.service';
import { StravaClientService } from 'src/strava/client/strava-client.service';
import { LapType } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const { mockPrisma } = vi.hoisted(() => {
  return {
    mockPrisma: {
      activity: {
        findUnique: vi.fn(),
        findFirst:  vi.fn(),
        create:     vi.fn(),
      },
      activityLap: {
        createMany: vi.fn(),
      },
      activitySecond: {
        createMany: vi.fn(),
        findMany:   vi.fn(),
      },
      $transaction: vi.fn(),
      $disconnect:  vi.fn(),
    }
  };
});
 
vi.mock('@prisma/client', () => {
  return {
    PrismaClient: vi.fn().mockImplementation(function (this: any) {
      return mockPrisma;
    }),
    LapType: {
      RUN:      'RUN',
      WORKOUT:  'WORKOUT',
      REST:     'REST',
      STEADY:   'STEADY',
      WARMUP:   'WARMUP',
      COOLDOWN: 'COOLDOWN',
      ACTIVITY: 'ACTIVITY',
    },
    WorkoutType: {
      EASY_OR_LONG:  'EASY_OR_LONG',
      INTERVAL:      'INTERVAL',
      HILL_REPEATS:  'HILL_REPEATS',
    },
  };
});

vi.mock('@prisma/adapter-pg', () => {
  return {
    PrismaPg: class {},
  };
});

const USER_ID = 'user_test_123';

function makeStravaActivity(overrides: Partial<any> = {}): any {
  return {
    id:                   9876543210,
    name:                 'Morning Run',
    type:                 'Run',
    sport_type:           'Run',
    start_date:           '2024-03-15T07:00:00Z',
    distance:             10000,
    moving_time:          3600,
    elapsed_time:         3700,
    total_elevation_gain: 50,
    average_heartrate:    155,
    max_heartrate:        175,
    average_cadence:      85,
    description:          '',
    laps:                 [],
    splits_metric:        [],
    ...overrides,
  };
}

function makeStravaLap(index: number, avgSpeed: number, elevGain = 0): any {
  const movingTime = 1000 / avgSpeed;
  return {
    lap_index:              index,
    name:                   `Lap ${index}`,
    average_speed:          avgSpeed,
    distance:               1000,
    moving_time:            movingTime,
    elapsed_time:           movingTime + 5,
    total_elevation_gain:   elevGain,
    average_heartrate:      155,
    average_cadence:        85,
    start_index:            (index - 1) * movingTime,
    end_index:              index * movingTime,
  };
}

function makeMetricSplit(index: number, avgSpeed: number, elevDiff = 0): any {
  const movingTime = 1000 / avgSpeed;
  return {
    split:                  index,
    distance:               1000,
    moving_time:            movingTime,
    elapsed_time:           movingTime + 5,
    average_speed:          avgSpeed,
    average_heartrate:      155,
    elevation_difference:   elevDiff,
  };
}

describe('StravaSyncService', () => {
  let service: StravaSyncService;
  let stravaClient: any;

  beforeEach(async () => {
    vi.clearAllMocks();

    mockPrisma.$transaction.mockImplementation(async (cb: any) => cb(mockPrisma));
    mockPrisma.activity.findUnique.mockResolvedValue(null);
    mockPrisma.activity.findFirst.mockResolvedValue(null);
    mockPrisma.activity.create.mockResolvedValue({ id: 'act_id_1' });
    mockPrisma.activityLap.createMany.mockResolvedValue({ count: 1 });
    mockPrisma.activitySecond.createMany.mockResolvedValue({ count: 100 });
    mockPrisma.activitySecond.findMany.mockResolvedValue([]);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StravaSyncService,
        {
          provide: StravaClientService,
          useValue: {
            get: vi.fn(),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: vi.fn((key: string) => {
              if (key === 'DATABASE_URL') return 'postgresql://test';
              if (key === 'SEED_USER_ID')  return USER_ID;
              return undefined;
            }),
            getOrThrow: vi.fn((key: string) => {
              if (key === 'DATABASE_URL') return 'postgresql://test';
              if (key === 'SEED_USER_ID')  return USER_ID;
              throw new Error(`Config key not found: ${key}`);
            }),
          },
        },
      ],
    }).compile();

    service = module.get<StravaSyncService>(StravaSyncService);
    stravaClient = module.get(StravaClientService);
    stravaClient.get.mockResolvedValue({});

    vi.spyOn(service as any, 'sleep').mockResolvedValue(undefined);
  });

  describe('sync()', () => {
    it('retorna { synced: 0, errors: 0 } quando não há atividades novas', async () => {
      stravaClient.get.mockResolvedValueOnce([]);

      const result = await service.sync(USER_ID);

      expect(result).toEqual({ synced: 0, errors: 0 });
    });

    it('ignores activities that type is not run', async () => {
      stravaClient.get
        .mockResolvedValueOnce([
          { id: 1, type: 'Ride',  name: 'Bike' },
          { id: 2, type: 'Swim',  name: 'Swim' },
          { id: 3, type: 'Hike',  name: 'Hike' },
        ])
        .mockResolvedValueOnce([]);

      const result = await service.sync(USER_ID);

      expect(result.synced).toBe(0);
      expect(stravaClient.get).not.toHaveBeenCalledWith(
        USER_ID, expect.stringContaining('/activities/'), expect.anything(),
      );
    });

    it('increment synced for new processed activity', async () => {
      const activity = makeStravaActivity({
        splits_metric: [makeMetricSplit(1, 3.5)],
      });

      const mockStreams = {
        time:             { data: [0, 1] },
        distance:         { data: [0, 4] },
        velocity_smooth:  { data: [4, 4] },
        heartrate:        { data: [150, 151] },
        altitude:         { data: [100, 100] },
      };

      // Controle local para saber se a primeira página já foi entregue
      let listCalled = false;

      stravaClient.get.mockImplementation(async (userId: string, endpoint: string) => {
        // 1. Intercepta a listagem de atividades
        if (endpoint.includes('/athlete/activities')) {
          if (!listCalled) {
            listCalled = true;
            return [{ id: activity.id, type: 'Run', name: activity.name }]; // Página 1
          }
          return []; // Página 2 (vazia, quebra o loop do serviço)
        }

        // 2. Intercepta a busca de streams de segundos
        if (endpoint.includes('/streams')) {
          return mockStreams;
        }

        // 3. Intercepta o detalhe da atividade
        if (endpoint.includes('/activities/')) {
          return activity;
        }

        return null;
      });

      const result = await service.sync(USER_ID);

      expect(result.synced).toBe(1);
      expect(result.errors).toBe(0);
    });

    it('increment errors and continue when one activity fails', async () => {
      const activities = [
        { id: 1, type: 'Run', name: 'Erro' },
        { id: 2, type: 'Run', name: 'Ok' },
      ];

      const goodActivity = makeStravaActivity({
        id: 2,
        splits_metric: [makeMetricSplit(1, 3.5)],
      });

      stravaClient.get
        .mockResolvedValueOnce(activities)
        .mockResolvedValueOnce([])
        .mockRejectedValueOnce(new Error('API error'))
        .mockResolvedValueOnce(goodActivity);

      const result = await service.sync(USER_ID);

      expect(result.errors).toBe(1);
      expect(result.synced).toBe(1);
    });
    

    it('dont start second sync when one is already running', async () => {
      let resolveSlow: (value: any[]) => void;
      const slowPromise = new Promise<any[]>((resolve) => {
        resolveSlow = resolve;
      });

      stravaClient.get.mockReturnValueOnce(slowPromise as any);

      const firstSync  = service.sync(USER_ID);
      const secondSync = service.sync(USER_ID);

      const secondResult = await secondSync;
      expect(secondResult).toEqual({ synced: 0, errors: 0 });

      resolveSlow!([]);
      await firstSync;
    });
  });

  describe('workout type classification via description', () => {
    async function syncWithDescription(description: string) {
      const activity = makeStravaActivity({
        description,
        splits_metric: [makeMetricSplit(1, 3.5)],
      });

      const mockStreams = {
        time:             { data: [0, 1] },
        distance:         { data: [0, 4] },
        velocity_smooth:  { data: [4, 4] },
        heartrate:        { data: [150, 151] },
        altitude:         { data: [100, 100] },
      };

      stravaClient.get
        .mockResolvedValueOnce([{ id: activity.id, type: 'Run' }])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce(activity)
        .mockResolvedValue(mockStreams);

      await service.sync(USER_ID);

      return mockPrisma.activity.create.mock.calls[0]?.[0]?.data?.workoutType;
    }

    it('classify as EASY_OR_LONG when description is empty', async () => {
      expect(await syncWithDescription('')).toBe('EASY_OR_LONG');
    });

    it('classify as INTERVAL for "8 tiros de 400m" (pt-br)', async () => {
      expect(await syncWithDescription('8 tiros de 400m')).toBe('INTERVAL');
    });

    it('classify as INTERVAL for "10x400"', async () => {
      expect(await syncWithDescription('10x400')).toBe('INTERVAL');
    });

    it('classify as HILL_REPEATS for "hill repeats"', async () => {
      expect(await syncWithDescription('hill repeats')).toBe('HILL_REPEATS');
    });

    it('classify as HILL_REPEATS for "subida" (pt-br)', async () => {
      expect(await syncWithDescription('6x subida')).toBe('HILL_REPEATS');
    });
  });

  describe('laps processing for EASY_OR_LONG runs', () => {
    it('use pre recorded laps', async () => {
      const activity = makeStravaActivity({
        laps: [
          makeStravaLap(1, 3.2),
          makeStravaLap(2, 3.3),
          makeStravaLap(3, 3.1),
        ],
      });

      stravaClient.get
        .mockResolvedValueOnce([{ id: activity.id, type: 'Run' }])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce(activity);

      await service.sync(USER_ID);

      expect(mockPrisma.activityLap.createMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.arrayContaining([
            expect.objectContaining({
              lapType: LapType.STEADY,
              avgCadence: 170,
            }),
          ]),
        }),
      );
    });

    it('computes negative elevGainM for a downhill recorded lap from the altitude stream', async () => {
      const altStream: number[] = [];
      altStream[0]   = 100;
      altStream[100] = 150;
      altStream[200] = 80;

      const activity = makeStravaActivity({
        laps: [
          {
            lap_index: 1, name: 'Lap 1', average_speed: 3.0, distance: 1000,
            moving_time: 333, elapsed_time: 335, average_heartrate: 150,
            start_index: 0, end_index: 100,
          },
          {
            lap_index: 2, name: 'Lap 2', average_speed: 3.0, distance: 1000,
            moving_time: 333, elapsed_time: 335, average_heartrate: 150,
            start_index: 100, end_index: 200,
          },
        ],
      });

      stravaClient.get
        .mockResolvedValueOnce([{ id: activity.id, type: 'Run' }])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce(activity)
        .mockResolvedValueOnce({ altitude: { data: altStream } });

      await service.sync(USER_ID);

      const createCall = mockPrisma.activityLap.createMany.mock.calls[0][0];
      expect(createCall.data[0].elevGainM).toBe(50);
      expect(createCall.data[1].elevGainM).toBe(-70);
      expect(createCall.data[1].avgGradePercent).toBe(-7);
      expect(createCall.data[1].vam).toBe(0);
    });

    it('converts activity-level average_cadence from rpm to spm', async () => {
      const activity = makeStravaActivity({ average_cadence: 85 });

      stravaClient.get
        .mockResolvedValueOnce([{ id: activity.id, type: 'Run' }])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce(activity);

      await service.sync(USER_ID);

      expect(mockPrisma.activity.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ averageCadence: 170 }),
        }),
      );
    });

    it('[use splits_metric when there is no recorded laps', async () => {
      const activity = makeStravaActivity({
        laps:          [{ name: 'Strava Auto Lap', ...makeStravaLap(1, 3.5) }],
        splits_metric: [
          makeMetricSplit(1, 3.4),
          makeMetricSplit(2, 3.5),
          makeMetricSplit(3, 3.6),
        ],
      });

      stravaClient.get
        .mockResolvedValueOnce([{ id: activity.id, type: 'Run' }])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce(activity);

      await service.sync(USER_ID);

      expect(mockPrisma.activityLap.createMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.arrayContaining([
            expect.objectContaining({ lapType: 'STEADY' }),
          ]),
        }),
      );
    });
  });

  describe('laps processing for INTERVAL', () => {
    it('classify recorded laps with classifyIntervalLapsType', async () => {
      const activity = makeStravaActivity({
        description: '8x400m',
        laps: [
          makeStravaLap(1, 2.8),
          makeStravaLap(2, 4.5),
          makeStravaLap(3, 2.5),
          makeStravaLap(4, 4.5),
          makeStravaLap(5, 2.5),
          makeStravaLap(6, 3.0),
        ],
      });

      stravaClient.get
        .mockResolvedValueOnce([{ id: activity.id, type: 'Run' }])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce(activity);

      await service.sync(USER_ID);

      const createCall = mockPrisma.activityLap.createMany.mock.calls[0][0];
      const types: string[] = createCall.data.map((l: any) => l.lapType);
      const cadences: number[] = createCall.data.map((l: any) => l.avgCadence);

      expect(types[0]).toBe(LapType.WARMUP);
      expect(types[types.length - 1]).toBe(LapType.COOLDOWN);;
      expect(types).toContain(LapType.WORKOUT);
      expect(types).toContain(LapType.REST);
      expect(cadences).toEqual(cadences.map(() => 170));
    });

    
    it('download streams and autodetect laps when there is not recorded ones', async () => {
      const activity = makeStravaActivity({
        description:   '6x200m',
        laps:          [],
        splits_metric: [makeMetricSplit(1, 4.0), makeMetricSplit(2, 4.0)],
      });

      const mockStreams = {
        time:             { data: [0, 1, 2, 3, 4] },
        distance:         { data: [0, 4, 8, 12, 16] },
        velocity_smooth:  { data: [4, 4, 4, 4, 4] },
        heartrate:        { data: [150, 151, 152, 153, 154] },
        altitude:         { data: [100, 100, 100, 100, 100] },
      };

      stravaClient.get
        .mockResolvedValueOnce([{ id: activity.id, type: 'Run' }])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce(activity)
        .mockResolvedValueOnce(mockStreams);

      await service.sync(USER_ID);

      expect(mockPrisma.activitySecond.createMany).toHaveBeenCalled();
      expect(mockPrisma.activityLap.createMany).toHaveBeenCalled();
    });

    it('keeps negative elevGainM on the splits_metric fallback when the detector finds no laps', async () => {
      const activity = makeStravaActivity({
        description:   '6x200m',
        laps:          [],
        splits_metric: [makeMetricSplit(1, 4.0, -15)],
      });

      const mockStreams = {
        time:             { data: [0, 1, 2, 3, 4] },
        distance:         { data: [0, 4, 8, 12, 16] },
        velocity_smooth:  { data: [4, 4, 4, 4, 4] },
        heartrate:        { data: [150, 151, 152, 153, 154] },
        altitude:         { data: [100, 100, 100, 100, 100] },
      };

      stravaClient.get
        .mockResolvedValueOnce([{ id: activity.id, type: 'Run' }])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce(activity)
        .mockResolvedValueOnce(mockStreams);

      await service.sync(USER_ID);

      const createCall = mockPrisma.activityLap.createMany.mock.calls[0][0];
      expect(createCall.data[0].elevGainM).toBe(-15);
    });
  });

  describe('activities paging', () => {
    it('fetch activities until reaches one that is empty/null', async () => {
      const page1 = [
        { id: 1, type: 'Run', name: 'Run 1' },
        { id: 2, type: 'Run', name: 'Run 2' },
      ];

      const act1 = makeStravaActivity({ id: 1, splits_metric: [makeMetricSplit(1, 3.5)] });
      const act2 = makeStravaActivity({ id: 2, splits_metric: [makeMetricSplit(1, 3.5)] });

      stravaClient.get
        .mockResolvedValueOnce(page1)
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce(act1)
        .mockResolvedValueOnce(act2);

      const result = await service.sync(USER_ID);

      expect(result.synced).toBe(2);
    });
  });

  describe('last activity timestamp', () => {
    it('when exists another activity in the db pass "after"', async () => {
      const lastDate = new Date('2024-03-10T10:00:00Z');
      mockPrisma.activity.findFirst.mockResolvedValueOnce({
        startDate: lastDate,
      });

      stravaClient.get.mockResolvedValueOnce([]);

      await service.sync(USER_ID);

      const expectedAfter = Math.floor(lastDate.getTime() / 1000);

      expect(stravaClient.get).toHaveBeenCalledWith(
        USER_ID,
        '/athlete/activities',
        expect.objectContaining({ after: expectedAfter }),
      );
    });

    it('dont pass "after" when db is empty', async () => {
      mockPrisma.activity.findFirst.mockResolvedValueOnce(null);
      stravaClient.get.mockResolvedValueOnce([]);

      await service.sync(USER_ID);

      expect(stravaClient.get).toHaveBeenCalledWith(
        USER_ID,
        '/athlete/activities',
        expect.not.objectContaining({ after: expect.anything() }),
      );
    });
  });
});