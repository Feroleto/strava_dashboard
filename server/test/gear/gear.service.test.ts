import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { GearService } from 'src/gear/gear.service';

const { mockPrisma } = vi.hoisted(() => {
  return {
    mockPrisma: {
      gear: {
        findMany: vi.fn(),
      },
      activity: {
        groupBy: vi.fn(),
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

describe('GearService', () => {
  let service: GearService;

  beforeEach(async () => {
    vi.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GearService,
        {
          provide: ConfigService,
          useValue: { get: vi.fn(() => 'postgresql://test') },
        },
      ],
    }).compile();

    service = module.get(GearService);
  });

  it('converts computed distanceKm (activities) to meters and merges with gear rows', async () => {
    mockPrisma.gear.findMany.mockResolvedValueOnce([
      {
        id: 'g1',
        name: 'Pegasus 40',
        brandName: 'Nike',
        modelName: 'Pegasus',
        distance: 452000,
        primary: true,
        retired: false,
      },
    ]);
    mockPrisma.activity.groupBy.mockResolvedValueOnce([
      {
        gearId: 'g1',
        _sum: { distanceKm: 100.5 },
        _count: { _all: 12 },
        _min: { startDate: new Date('2025-11-03T00:00:00Z') },
        _max: { startDate: new Date('2026-06-01T00:00:00Z') },
      },
    ]);

    const result = await service.list(USER_ID);

    expect(result).toEqual([
      {
        id: 'g1',
        name: 'Pegasus 40',
        brandName: 'Nike',
        modelName: 'Pegasus',
        distance: 452000,
        computedDistanceM: 100500,
        runCount: 12,
        firstUseDate: '2025-11-03T00:00:00.000Z',
        lastUseDate: '2026-06-01T00:00:00.000Z',
        primary: true,
        retired: false,
      },
    ]);
  });

  it('defaults computedDistanceM/runCount/firstUseDate/lastUseDate when there are no linked activities', async () => {
    mockPrisma.gear.findMany.mockResolvedValueOnce([
      {
        id: 'g1',
        name: 'Pegasus 40',
        brandName: null,
        modelName: null,
        distance: 0,
        primary: false,
        retired: true,
      },
    ]);
    mockPrisma.activity.groupBy.mockResolvedValueOnce([]);

    const [item] = await service.list(USER_ID);
    expect(item.computedDistanceM).toBe(0);
    expect(item.runCount).toBe(0);
    expect(item.firstUseDate).toBeNull();
    expect(item.lastUseDate).toBeNull();
  });
});
