import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { AthleteZonesSyncService } from 'src/strava/hr-zones/athlete-zones-sync.service';
import { StravaClientService } from 'src/strava/client/strava-client.service';

const { mockPrisma } = vi.hoisted(() => {
  return {
    mockPrisma: {
      athleteHrZones: {
        upsert: vi.fn(),
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

describe('AthleteZonesSyncService', () => {
  let service: AthleteZonesSyncService;
  let stravaClient: any;

  beforeEach(async () => {
    vi.clearAllMocks();

    mockPrisma.athleteHrZones.upsert.mockResolvedValue({});

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AthleteZonesSyncService,
        {
          provide: StravaClientService,
          useValue: { get: vi.fn() },
        },
        {
          provide: ConfigService,
          useValue: { get: vi.fn(() => 'postgresql://test') },
        },
      ],
    }).compile();

    service = module.get(AthleteZonesSyncService);
    stravaClient = module.get(StravaClientService);
  });

  it('upserts AthleteHrZones on success', async () => {
    stravaClient.get.mockResolvedValueOnce({
      heart_rate: {
        custom_zones: true,
        zones: [
          { min: 0, max: 115 },
          { min: 115, max: 145 },
          { min: 145, max: -1 },
        ],
      },
    });

    const result = await service.syncAthleteZones(USER_ID);

    expect(result.zones).toEqual([
      { min: 0, max: 115 },
      { min: 115, max: 145 },
      { min: 145, max: -1 },
    ]);
    expect(mockPrisma.athleteHrZones.upsert).toHaveBeenCalledWith({
      where: { userId: USER_ID },
      create: expect.objectContaining({ userId: USER_ID, customZones: true }),
      update: expect.objectContaining({ customZones: true }),
    });
  });

  it('returns { zones: null } and does not upsert when Strava returns no zones', async () => {
    stravaClient.get.mockResolvedValueOnce({ heart_rate: { custom_zones: false, zones: [] } });

    const result = await service.syncAthleteZones(USER_ID);

    expect(result).toEqual({ zones: null });
    expect(mockPrisma.athleteHrZones.upsert).not.toHaveBeenCalled();
  });

  it('returns { zones: null } and does not upsert when heart_rate is missing (missing scope)', async () => {
    stravaClient.get.mockResolvedValueOnce({});

    const result = await service.syncAthleteZones(USER_ID);

    expect(result).toEqual({ zones: null });
    expect(mockPrisma.athleteHrZones.upsert).not.toHaveBeenCalled();
  });
});
