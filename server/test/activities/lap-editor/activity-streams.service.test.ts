import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import {
  ActivityStreamsService,
  StreamUnavailableError,
} from 'src/activities/lap-editor/activity-streams.service';
import { StravaClientService } from 'src/strava/client/strava-client.service';

const { mockPrisma } = vi.hoisted(() => {
  return {
    mockPrisma: {
      activity: {
        findFirst: vi.fn(),
      },
      activitySecond: {
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
  return { PrismaPg: class {} };
});

const USER_ID = 'user-1';
const ACTIVITY_ID = 'act-1';

describe('ActivityStreamsService.getStream', () => {
  let service: ActivityStreamsService;
  let stravaClient: any;

  beforeEach(async () => {
    vi.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ActivityStreamsService,
        { provide: StravaClientService, useValue: { get: vi.fn() } },
        {
          provide: ConfigService,
          useValue: { get: vi.fn(() => 'postgresql://test') },
        },
      ],
    }).compile();

    service = module.get(ActivityStreamsService);
    stravaClient = module.get(StravaClientService);
  });

  it('returns null when the activity does not exist / is not owned by the user', async () => {
    mockPrisma.activity.findFirst.mockResolvedValueOnce(null);

    const result = await service.getStream(USER_ID, ACTIVITY_ID);

    expect(result).toBeNull();
    expect(mockPrisma.activitySecond.findMany).not.toHaveBeenCalled();
  });

  it('serves from ActivitySecond when rows are already stored', async () => {
    mockPrisma.activity.findFirst.mockResolvedValueOnce({ stravaId: 123n });
    mockPrisma.activitySecond.findMany.mockResolvedValueOnce([
      { secondIndex: 0, distanceTotalM: 0, heartRate: 140, elevationM: 100, cadence: 170 },
      { secondIndex: 1, distanceTotalM: 4, heartRate: 142, elevationM: 100, cadence: 172 },
    ]);

    const result = await service.getStream(USER_ID, ACTIVITY_ID);

    expect(result).not.toBeNull();
    expect(result!.source).toBe('stored');
    expect(result!.points).toHaveLength(2);
    expect(stravaClient.get).not.toHaveBeenCalled();
  });

  it('fetches from Strava (including cadence) when no ActivitySecond rows exist', async () => {
    mockPrisma.activity.findFirst.mockResolvedValueOnce({ stravaId: 456n });
    mockPrisma.activitySecond.findMany.mockResolvedValueOnce([]);
    stravaClient.get.mockResolvedValueOnce({
      time: { data: [0, 1, 2] },
      distance: { data: [0, 4, 8] },
      heartrate: { data: [140, 142, 144] },
      altitude: { data: [100, 100, 101] },
      cadence: { data: [85, 86, 87] }, // rpm, expect ×2 conversion to spm
    });

    const result = await service.getStream(USER_ID, ACTIVITY_ID);

    expect(stravaClient.get).toHaveBeenCalledWith(
      USER_ID,
      '/activities/456/streams',
      expect.objectContaining({ keys: expect.stringContaining('cadence') }),
    );
    expect(result!.source).toBe('strava');
    expect(result!.points).toHaveLength(3);
    expect(result!.points[0].cadence).toBe(170);
  });

  it('caches the result so a second call within the TTL skips the Strava fetch', async () => {
    mockPrisma.activity.findFirst.mockResolvedValue({ stravaId: 456n });
    mockPrisma.activitySecond.findMany.mockResolvedValueOnce([]);
    stravaClient.get.mockResolvedValueOnce({
      time: { data: [0, 1] },
      distance: { data: [0, 4] },
      heartrate: { data: [140, 142] },
      altitude: { data: [100, 100] },
      cadence: { data: [] },
    });

    await service.getStream(USER_ID, ACTIVITY_ID);
    const second = await service.getStream(USER_ID, ACTIVITY_ID);

    expect(stravaClient.get).toHaveBeenCalledTimes(1);
    expect(second!.source).toBe('strava');
  });

  it('throws StreamUnavailableError when the Strava fetch fails', async () => {
    mockPrisma.activity.findFirst.mockResolvedValueOnce({ stravaId: 789n });
    mockPrisma.activitySecond.findMany.mockResolvedValueOnce([]);
    stravaClient.get.mockRejectedValueOnce(new Error('STRAVA_RATE_LIMIT'));

    await expect(service.getStream(USER_ID, ACTIVITY_ID)).rejects.toThrow(
      StreamUnavailableError,
    );
  });

  it('throws StreamUnavailableError when Strava returns an empty time stream', async () => {
    mockPrisma.activity.findFirst.mockResolvedValueOnce({ stravaId: 789n });
    mockPrisma.activitySecond.findMany.mockResolvedValueOnce([]);
    stravaClient.get.mockResolvedValueOnce({ time: { data: [] } });

    await expect(service.getStream(USER_ID, ACTIVITY_ID)).rejects.toThrow(
      StreamUnavailableError,
    );
  });
});
