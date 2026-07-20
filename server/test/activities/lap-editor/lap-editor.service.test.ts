import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import {
  BadRequestException,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { LapEditorService } from 'src/activities/lap-editor/lap-editor.service';
import {
  ActivityStreamsService,
  StreamUnavailableError,
} from 'src/activities/lap-editor/activity-streams.service';
import { ActivitiesService } from 'src/activities/activities.service';
import { LapEditInput } from 'src/activities/lap-editor/dto';
import { ProcessedSecond } from 'src/strava/sync/types';

const { mockPrisma } = vi.hoisted(() => {
  return {
    mockPrisma: {
      activityLap: {
        deleteMany: vi.fn(),
        createMany: vi.fn(),
      },
      $transaction: vi.fn(),
    },
  };
});

vi.mock('@prisma/client', () => {
  return {
    PrismaClient: vi.fn().mockImplementation(function (this: any) {
      return mockPrisma;
    }),
    LapType: {
      RUN: 'RUN',
      WORKOUT: 'WORKOUT',
      REST: 'REST',
      STEADY: 'STEADY',
      WARMUP: 'WARMUP',
      COOLDOWN: 'COOLDOWN',
      ACTIVITY: 'ACTIVITY',
    },
  };
});

vi.mock('@prisma/adapter-pg', () => {
  return { PrismaPg: class {} };
});

function makePoint(overrides: Partial<ProcessedSecond>): ProcessedSecond {
  return {
    secondIndex: 0,
    distanceTotalM: 0,
    distanceDeltaM: 0,
    speedRaw: 0,
    speedMs: 4,
    accelerationMs2: 0,
    heartRate: 150,
    elevationM: 100,
    elevationSmooth: 100,
    elevationDelta: 0,
    gradePercent: 0,
    verticalSpeedMs: 0,
    paceSeckm: 250,
    cadence: 170,
    ...overrides,
  };
}

// one point per second, distPerSec meters/sec
function makeStream(count: number, distPerSec: number): ProcessedSecond[] {
  return Array.from({ length: count }, (_, i) =>
    makePoint({ secondIndex: i, distanceTotalM: i * distPerSec }),
  );
}

const USER_ID = 'user-1';
const ACTIVITY_ID = 'act-1';

describe('LapEditorService.saveLaps', () => {
  let service: LapEditorService;
  let streams: { getStream: ReturnType<typeof vi.fn> };
  let activitiesService: { findById: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    vi.clearAllMocks();
    mockPrisma.activityLap.deleteMany.mockResolvedValue({ count: 0 });
    mockPrisma.activityLap.createMany.mockResolvedValue({ count: 0 });
    mockPrisma.$transaction.mockImplementation(async (ops: any[]) =>
      Promise.all(ops),
    );

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LapEditorService,
        { provide: ActivityStreamsService, useValue: { getStream: vi.fn() } },
        { provide: ActivitiesService, useValue: { findById: vi.fn() } },
        {
          provide: ConfigService,
          useValue: { get: vi.fn(() => 'postgresql://test') },
        },
      ],
    }).compile();

    service = module.get(LapEditorService);
    streams = module.get(ActivityStreamsService) as any;
    activitiesService = module.get(ActivitiesService) as any;
  });

  it('resolves distance-mode laps sequentially and persists them', async () => {
    const points = makeStream(100, 4); // covers 0..396m over 100s
    streams.getStream.mockResolvedValue({ points, source: 'stored' });
    activitiesService.findById.mockResolvedValue({ laps: [] });

    const input: LapEditInput[] = [
      { lapType: 'RUN' as any, sizeMode: 'distance', sizeValue: 200 },
      { lapType: 'RUN' as any, sizeMode: 'distance', sizeValue: 196 },
    ];

    await service.saveLaps(USER_ID, ACTIVITY_ID, input);

    expect(mockPrisma.activityLap.deleteMany).toHaveBeenCalledWith({
      where: { activityId: ACTIVITY_ID },
    });
    const created = mockPrisma.activityLap.createMany.mock.calls[0][0].data;
    expect(created).toHaveLength(2);
    expect(created[0].lapIndex).toBe(1);
    expect(created[1].lapIndex).toBe(2);
    expect(created[1].startSec).toBeGreaterThan(created[0].endSec);
  });

  it('reflows laps after the previous one when sizes change (no stored position)', async () => {
    const points = makeStream(100, 4);
    streams.getStream.mockResolvedValue({ points, source: 'stored' });
    activitiesService.findById.mockResolvedValue({ laps: [] });

    await service.saveLaps(USER_ID, ACTIVITY_ID, [
      { lapType: 'WORKOUT' as any, sizeMode: 'time', sizeValue: 50 },
      { lapType: 'REST' as any, sizeMode: 'time', sizeValue: 50 },
    ]);

    const created = mockPrisma.activityLap.createMany.mock.calls[0][0].data;
    expect(created[0].startSec).toBe(0);
    expect(created[0].endSec).toBe(49);
    expect(created[1].startSec).toBe(50);
    expect(created[1].endSec).toBe(99);
  });

  it('rejects with a deficit when laps do not cover the full activity', async () => {
    const points = makeStream(100, 4);
    streams.getStream.mockResolvedValue({ points, source: 'stored' });

    await expect(
      service.saveLaps(USER_ID, ACTIVITY_ID, [
        { lapType: 'RUN' as any, sizeMode: 'distance', sizeValue: 100 },
      ]),
    ).rejects.toThrow(BadRequestException);
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
  });

  it('rejects when a lap starts after the stream has already ended', async () => {
    const points = makeStream(20, 4); // short stream
    streams.getStream.mockResolvedValue({ points, source: 'stored' });

    await expect(
      service.saveLaps(USER_ID, ACTIVITY_ID, [
        { lapType: 'RUN' as any, sizeMode: 'time', sizeValue: 20 },
        { lapType: 'RUN' as any, sizeMode: 'time', sizeValue: 10 },
      ]),
    ).rejects.toThrow(BadRequestException);
  });

  it('throws NotFoundException when the stream lookup returns null', async () => {
    streams.getStream.mockResolvedValue(null);

    await expect(
      service.saveLaps(USER_ID, ACTIVITY_ID, [
        { lapType: 'RUN' as any, sizeMode: 'distance', sizeValue: 100 },
      ]),
    ).rejects.toThrow(NotFoundException);
  });

  it('translates StreamUnavailableError into UnprocessableEntityException', async () => {
    streams.getStream.mockRejectedValue(new StreamUnavailableError('nope'));

    await expect(
      service.saveLaps(USER_ID, ACTIVITY_ID, [
        { lapType: 'RUN' as any, sizeMode: 'distance', sizeValue: 100 },
      ]),
    ).rejects.toThrow(UnprocessableEntityException);
  });

  it('deleting a lap (fewer entries) leaves a deficit that blocks save until rebalanced', async () => {
    // a much longer stream than the 2 submitted laps cover, well beyond
    // COVERAGE_TOLERANCE_SEC — a real deficit (e.g. "deleted a whole lap
    // and didn't resize"), not the small source-data slop the tolerance
    // exists for, so it must still be rejected
    const points = makeStream(300, 4); // 0..1196m over 300s
    streams.getStream.mockResolvedValue({ points, source: 'stored' });

    await expect(
      service.saveLaps(USER_ID, ACTIVITY_ID, [
        { lapType: 'RUN' as any, sizeMode: 'distance', sizeValue: 100 },
        { lapType: 'RUN' as any, sizeMode: 'distance', sizeValue: 100 },
      ]),
    ).rejects.toThrow(BadRequestException);

    // rebalancing the last lap to absorb the gap succeeds
    activitiesService.findById.mockResolvedValue({ laps: [] });
    await service.saveLaps(USER_ID, ACTIVITY_ID, [
      { lapType: 'RUN' as any, sizeMode: 'distance', sizeValue: 100 },
      { lapType: 'RUN' as any, sizeMode: 'time', sizeValue: 274 },
    ]);
    expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
  });

  it('absorbs a small trailing shortfall into the last lap instead of blocking save', async () => {
    // simulates the real-world case that motivated the tolerance: laps
    // sourced from Strava's own metric splits, saved unedited, whose
    // distances don't sum to exactly the stream's true total — here the
    // 2 submitted laps fall 20 points (well within COVERAGE_TOLERANCE_SEC)
    // short of the 300-point stream
    const points = makeStream(300, 4);
    streams.getStream.mockResolvedValue({ points, source: 'stored' });
    activitiesService.findById.mockResolvedValue({ laps: [] });

    await service.saveLaps(USER_ID, ACTIVITY_ID, [
      { lapType: 'RUN' as any, sizeMode: 'time', sizeValue: 140 },
      { lapType: 'RUN' as any, sizeMode: 'time', sizeValue: 140 },
    ]);

    expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
    const created = mockPrisma.activityLap.createMany.mock.calls[0][0].data;
    // the last lap absorbed the remaining 20 points, ending exactly at the
    // stream's last second instead of leaving them unaccounted for
    expect(created[1].endSec).toBe(points[points.length - 1].secondIndex);
  });

  it('does not let overshoot compound across a chain of distance-mode laps', async () => {
    // distPerSec (3.7) doesn't divide evenly into the 1000m targets, so
    // every lap's "first point >= target" search necessarily overshoots
    // its own cumulative target by a bit, and a lap's *own* reported
    // distance also absorbs the one-point transition gap from the lap
    // before it — some wobble above/below 1000m per lap is expected and
    // bounded. The bug this guards against is resolving each lap's target
    // relative to wherever the *previous* lap actually ended (instead of
    // an absolute cumulative distance from a fixed anchor), which let that
    // wobble compound lap after lap — over several laps at this scale that
    // drifted by tens of meters, and the last lap absorbed it, reading
    // noticeably short. A trailing time-mode lap with a deliberately
    // oversized duration soaks up whatever's left, so the save succeeds
    // regardless of exactly how the 9 distance-mode laps resolve — only
    // their own distances are under test here.
    const points = makeStream(4000, 3.7); // 0..14796.3m over 4000s
    streams.getStream.mockResolvedValue({ points, source: 'stored' });
    activitiesService.findById.mockResolvedValue({ laps: [] });

    const input: LapEditInput[] = [
      ...Array.from({ length: 9 }, () => ({
        lapType: 'RUN' as any,
        sizeMode: 'distance' as const,
        sizeValue: 1000,
      })),
      { lapType: 'RUN' as any, sizeMode: 'time', sizeValue: 100_000 },
    ];

    await service.saveLaps(USER_ID, ACTIVITY_ID, input);

    const created = mockPrisma.activityLap.createMany.mock.calls[0][0].data;
    expect(created).toHaveLength(10);
    const distances = created.slice(0, 9).map((lap: any) => lap.distanceM);

    // bounded per-lap wobble, not compounding: with the bug, 9 laps at
    // this scale drifted by ~25m; without it, the spread stays well under that
    const spread = Math.max(...distances) - Math.min(...distances);
    expect(spread).toBeLessThan(4 * 3.7);
    distances.forEach((d: number) => {
      expect(d).toBeGreaterThan(1000 - 3 * 3.7);
      expect(d).toBeLessThan(1000 + 2 * 3.7);
    });
  });
});
