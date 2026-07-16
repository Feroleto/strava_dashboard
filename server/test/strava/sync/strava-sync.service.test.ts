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
        updateMany: vi.fn(),
      },
      activityLap: {
        createMany: vi.fn(),
      },
      activitySecond: {
        createMany: vi.fn(),
        findMany:   vi.fn(),
      },
      activityBestEffort: {
        createMany: vi.fn(),
      },
      activityHrZoneTime: {
        createMany: vi.fn(),
      },
      gear: {
        findUnique: vi.fn(),
        upsert:     vi.fn(),
      },
      stravaAccount: {
        findMany: vi.fn(),
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
    mockPrisma.activityBestEffort.createMany.mockResolvedValue({ count: 0 });
    mockPrisma.activityHrZoneTime.createMany.mockResolvedValue({ count: 0 });
    mockPrisma.gear.findUnique.mockResolvedValue(null);
    mockPrisma.gear.upsert.mockResolvedValue({});
    mockPrisma.activity.updateMany.mockResolvedValue({ count: 0 });

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
              return undefined;
            }),
            getOrThrow: vi.fn((key: string) => {
              if (key === 'DATABASE_URL') return 'postgresql://test';
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

      expect(result).toEqual({ synced: 0, errors: 0, rateLimited: false });
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
      expect(secondResult).toEqual({ synced: 0, errors: 0, rateLimited: false });

      resolveSlow!([]);
      await firstSync;
    });

    it('aborts the run and reports rateLimited when Strava rate-limits activity listing', async () => {
      stravaClient.get.mockRejectedValueOnce(new Error('STRAVA_RATE_LIMIT'));

      const result = await service.sync(USER_ID);

      expect(result).toEqual({ synced: 0, errors: 0, rateLimited: true });
    });

    it('aborts processing (without sleeping/retrying) when a single activity hits the rate limit', async () => {
      const activities = [
        { id: 1, type: 'Run', name: 'Rate limited' },
        { id: 2, type: 'Run', name: 'Never reached' },
      ];

      stravaClient.get
        .mockResolvedValueOnce(activities)
        .mockResolvedValueOnce([])
        .mockRejectedValueOnce(new Error('STRAVA_RATE_LIMIT'));

      const result = await service.sync(USER_ID);

      expect(result).toEqual({ synced: 0, errors: 0, rateLimited: true });
      // only the first activity's detail fetch happened — the loop broke
      // before reaching the second one
      expect(stravaClient.get).not.toHaveBeenCalledWith(
        USER_ID, expect.stringContaining('/activities/2'), expect.anything(),
      );
    });

    it('processes activities oldest-first even when the listing comes newest-first (initial import)', async () => {
      // sem `after` (banco vazio) a Strava lista da mais recente pra mais
      // antiga — o sync precisa reordenar pra que o max(startDate) salvo
      // funcione como cursor de retomada se o import cair no meio
      const activities = [
        { id: 2, type: 'Run', name: 'Newest', start_date: '2024-03-02T07:00:00Z' },
        { id: 1, type: 'Run', name: 'Oldest', start_date: '2024-03-01T07:00:00Z' },
      ];

      stravaClient.get
        .mockResolvedValueOnce(activities)
        .mockResolvedValueOnce([]);
      stravaClient.get.mockImplementation(async (_userId: string, path: string) => {
        if (path === '/activities/1')
          return makeStravaActivity({
            id: 1,
            start_date: '2024-03-01T07:00:00Z',
            splits_metric: [makeMetricSplit(1, 3.5)],
          });
        if (path === '/activities/2')
          return makeStravaActivity({
            id: 2,
            start_date: '2024-03-02T07:00:00Z',
            splits_metric: [makeMetricSplit(1, 3.5)],
          });
        return {};
      });

      const result = await service.sync(USER_ID);

      expect(result.synced).toBe(2);
      const detailCalls = stravaClient.get.mock.calls
        .map((call: any[]) => call[1])
        .filter((path: string) => /^\/activities\/\d+$/.test(path));
      expect(detailCalls).toEqual(['/activities/1', '/activities/2']);
    });
  });

  describe('syncAllAccounts()', () => {
    it('syncs every connected account sequentially', async () => {
      mockPrisma.stravaAccount.findMany.mockResolvedValueOnce([
        { userId: 'user_a' },
        { userId: 'user_b' },
      ]);
      const syncSpy = vi.spyOn(service, 'sync').mockResolvedValue({
        synced: 0,
        errors: 0,
        rateLimited: false,
      });

      await service.syncAllAccounts();

      expect(syncSpy).toHaveBeenNthCalledWith(1, 'user_a');
      expect(syncSpy).toHaveBeenNthCalledWith(2, 'user_b');
    });

    it('stops the batch as soon as one account reports rateLimited, without syncing the rest', async () => {
      mockPrisma.stravaAccount.findMany.mockResolvedValueOnce([
        { userId: 'user_a' },
        { userId: 'user_b' },
      ]);
      const syncSpy = vi
        .spyOn(service, 'sync')
        .mockResolvedValueOnce({ synced: 0, errors: 0, rateLimited: true });

      await service.syncAllAccounts();

      expect(syncSpy).toHaveBeenCalledTimes(1);
      expect(syncSpy).toHaveBeenCalledWith('user_a');
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
        .mockResolvedValueOnce([]) // HR zones for this activity — none available
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
        .mockResolvedValueOnce([]) // HR zones for act1 — none available
        .mockResolvedValueOnce(act2)
        .mockResolvedValueOnce([]); // HR zones for act2 — none available

      const result = await service.sync(USER_ID);

      expect(result.synced).toBe(2);
    });
  });

  describe('gear sync', () => {
    function mockGetForActivity(activity: any, gearResponse?: any) {
      let listCalled = false;
      stravaClient.get.mockImplementation(async (_userId: string, endpoint: string) => {
        if (endpoint.includes('/athlete/activities')) {
          if (!listCalled) {
            listCalled = true;
            return [{ id: activity.id, type: 'Run', name: activity.name }];
          }
          return [];
        }
        if (endpoint.startsWith('/gear/')) {
          if (gearResponse instanceof Error) throw gearResponse;
          return gearResponse;
        }
        if (endpoint.includes('/activities/')) {
          return activity;
        }
        return null;
      });
    }

    it('fetches and upserts gear when the activity has an unseen gear_id', async () => {
      const activity = makeStravaActivity({
        gear_id: 'g123',
        splits_metric: [makeMetricSplit(1, 3.5)],
      });
      mockGetForActivity(activity, {
        id: 'g123',
        name: 'Pegasus 40',
        brand_name: 'Nike',
        model_name: 'Pegasus',
        distance: 452000,
        primary: true,
        retired: false,
      });

      await service.sync(USER_ID);

      expect(mockPrisma.gear.upsert).toHaveBeenCalledWith({
        where: { id: 'g123' },
        create: expect.objectContaining({ id: 'g123', userId: USER_ID, name: 'Pegasus 40' }),
        update: expect.objectContaining({ id: 'g123', userId: USER_ID, name: 'Pegasus 40' }),
      });
      expect(mockPrisma.activity.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ gearId: 'g123' }) }),
      );
    });

    it('does not re-fetch gear details when the gear already exists', async () => {
      mockPrisma.gear.findUnique.mockResolvedValueOnce({ id: 'g123' });
      const activity = makeStravaActivity({
        gear_id: 'g123',
        splits_metric: [makeMetricSplit(1, 3.5)],
      });
      mockGetForActivity(activity);

      await service.sync(USER_ID);

      expect(stravaClient.get).not.toHaveBeenCalledWith(
        USER_ID, expect.stringContaining('/gear/'), expect.anything(),
      );
      expect(mockPrisma.gear.upsert).not.toHaveBeenCalled();
      expect(mockPrisma.activity.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ gearId: 'g123' }) }),
      );
    });

    it('saves the activity with gearId null when the gear fetch fails', async () => {
      const activity = makeStravaActivity({
        gear_id: 'g123',
        splits_metric: [makeMetricSplit(1, 3.5)],
      });
      mockGetForActivity(activity, new Error('Strava API error: 500 /gear/g123'));

      const result = await service.sync(USER_ID);

      expect(result.errors).toBe(0);
      expect(result.synced).toBe(1);
      expect(mockPrisma.activity.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ gearId: null }) }),
      );
    });
  });

  describe('best efforts incremental sync', () => {
    it('persists best_efforts from the already-fetched detail within the same transaction', async () => {
      const activity = makeStravaActivity({
        splits_metric: [makeMetricSplit(1, 3.5)],
        best_efforts: [
          {
            id: 555,
            name: '5k',
            distance: 5000,
            moving_time: 1200,
            elapsed_time: 1205,
            start_date: '2024-03-15T07:00:00Z',
            pr_rank: 1,
          },
        ],
      });

      stravaClient.get
        .mockResolvedValueOnce([{ id: activity.id, type: 'Run' }])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce(activity);

      await service.sync(USER_ID);

      expect(mockPrisma.activityBestEffort.createMany).toHaveBeenCalledWith({
        data: [
          expect.objectContaining({
            id: '555',
            activityId: 'act_id_1',
            name: '5k',
            prRank: 1,
          }),
        ],
      });
      expect(mockPrisma.activity.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ bestEffortsSyncedAt: expect.any(Date) }),
        }),
      );
    });

    it('does not call createMany when the activity has no best_efforts', async () => {
      const activity = makeStravaActivity({
        splits_metric: [makeMetricSplit(1, 3.5)],
      });

      stravaClient.get
        .mockResolvedValueOnce([{ id: activity.id, type: 'Run' }])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce(activity);

      await service.sync(USER_ID);

      expect(mockPrisma.activityBestEffort.createMany).not.toHaveBeenCalled();
    });
  });

  describe('hr zones incremental sync', () => {
    function mockGetWithZones(activity: any, zonesResponse: any) {
      let listCalled = false;
      stravaClient.get.mockImplementation(async (_userId: string, endpoint: string) => {
        if (endpoint.includes('/athlete/activities')) {
          if (!listCalled) {
            listCalled = true;
            return [{ id: activity.id, type: 'Run', name: activity.name }];
          }
          return [];
        }
        if (endpoint.endsWith('/zones')) {
          if (zonesResponse instanceof Error) throw zonesResponse;
          return zonesResponse;
        }
        if (endpoint.includes('/activities/')) {
          return activity;
        }
        return null;
      });
    }

    it('fetches and persists HR zone time distribution for a new activity', async () => {
      const activity = makeStravaActivity({
        splits_metric: [makeMetricSplit(1, 3.5)],
      });
      mockGetWithZones(activity, [
        {
          type: 'heartrate',
          distribution_buckets: [
            { min: 0, max: 115, time: 120 },
            { min: 115, max: 145, time: 900 },
            { min: 145, max: 165, time: 300 },
          ],
        },
      ]);

      await service.sync(USER_ID);

      expect(mockPrisma.activityHrZoneTime.createMany).toHaveBeenCalledWith({
        data: [
          { activityId: 'act_id_1', zoneIndex: 0, min: 0, max: 115, timeSec: 120 },
          { activityId: 'act_id_1', zoneIndex: 1, min: 115, max: 145, timeSec: 900 },
          { activityId: 'act_id_1', zoneIndex: 2, min: 145, max: 165, timeSec: 300 },
        ],
      });
      expect(mockPrisma.activity.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ hrZonesSyncedAt: expect.any(Date) }),
        }),
      );
    });

    it('marks hrZonesSyncedAt with no rows when Strava returns no zone data (non-premium account)', async () => {
      const activity = makeStravaActivity({
        splits_metric: [makeMetricSplit(1, 3.5)],
      });
      mockGetWithZones(activity, []);

      await service.sync(USER_ID);

      expect(mockPrisma.activityHrZoneTime.createMany).not.toHaveBeenCalled();
      expect(mockPrisma.activity.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ hrZonesSyncedAt: expect.any(Date) }),
        }),
      );
    });

    it('saves the activity with hrZonesSyncedAt null when the zones fetch fails', async () => {
      const activity = makeStravaActivity({
        splits_metric: [makeMetricSplit(1, 3.5)],
      });
      mockGetWithZones(activity, new Error('Strava API error: 500 /activities/9876543210/zones'));

      const result = await service.sync(USER_ID);

      expect(result.errors).toBe(0);
      expect(result.synced).toBe(1);
      expect(mockPrisma.activityHrZoneTime.createMany).not.toHaveBeenCalled();
      expect(mockPrisma.activity.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ hrZonesSyncedAt: null }),
        }),
      );
    });
  });

  describe('backfillGear', () => {
    it('resolves gear per unique gear_id and updates matching activities', async () => {
      let listCalled = false;
      stravaClient.get.mockImplementation(async (_userId: string, endpoint: string) => {
        if (endpoint.includes('/athlete/activities')) {
          if (!listCalled) {
            listCalled = true;
            return [
              { id: 1, type: 'Run', gear_id: 'g1' },
              { id: 2, type: 'Run', gear_id: 'g1' },
              { id: 3, type: 'Run', gear_id: null },
            ];
          }
          return [];
        }
        if (endpoint.startsWith('/gear/')) {
          return { id: 'g1', name: 'Pegasus', primary: true, retired: false, distance: 1000 };
        }
        return null;
      });
      mockPrisma.activity.updateMany.mockResolvedValue({ count: 1 });
      // simulate persistence: findUnique only misses before the first upsert
      mockPrisma.gear.findUnique
        .mockResolvedValueOnce(null)
        .mockResolvedValue({ id: 'g1' });

      const result = await service.backfillGear(USER_ID);

      expect(mockPrisma.gear.upsert).toHaveBeenCalledTimes(1);
      expect(mockPrisma.activity.updateMany).toHaveBeenCalledWith({
        where: { stravaId: 1n, gearId: null },
        data: { gearId: 'g1' },
      });
      expect(mockPrisma.activity.updateMany).toHaveBeenCalledWith({
        where: { stravaId: 2n, gearId: null },
        data: { gearId: 'g1' },
      });
      expect(result.updated).toBe(2);
    });

    it('skips activities without a gear_id', async () => {
      stravaClient.get
        .mockResolvedValueOnce([{ id: 1, type: 'Run', gear_id: null }])
        .mockResolvedValueOnce([]);

      const result = await service.backfillGear(USER_ID);

      expect(mockPrisma.activity.updateMany).not.toHaveBeenCalled();
      expect(result.updated).toBe(0);
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