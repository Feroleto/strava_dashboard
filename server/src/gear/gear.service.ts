import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

export interface GearListItem {
  id: string;
  name: string;
  brandName: string | null;
  modelName: string | null;
  distance: number;
  computedDistanceM: number;
  runCount: number;
  firstUseDate: string | null;
  lastUseDate: string | null;
  primary: boolean;
  retired: boolean;
}

@Injectable()
export class GearService {
  private readonly prisma: PrismaClient;

  constructor(private readonly config: ConfigService) {
    const adapter = new PrismaPg({
      connectionString: this.config.get<string>('DATABASE_URL'),
    });
    this.prisma = new PrismaClient({ adapter });
  }

  async list(userId: string): Promise<GearListItem[]> {
    const [gear, aggregates] = await Promise.all([
      this.prisma.gear.findMany({
        where: { userId },
        select: {
          id: true,
          name: true,
          brandName: true,
          modelName: true,
          distance: true,
          primary: true,
          retired: true,
        },
        orderBy: [{ retired: 'asc' }, { primary: 'desc' }, { name: 'asc' }],
      }),
      this.prisma.activity.groupBy({
        by: ['gearId'],
        where: { userId, gearId: { not: null } },
        _sum: { distanceKm: true },
        _count: { _all: true },
        _min: { startDate: true },
        _max: { startDate: true },
      }),
    ]);

    // Activity.distanceKm is kilometers, Gear.distance (from Strava) is meters
    const aggByGearId = new Map(
      aggregates.map((a) => [
        a.gearId as string,
        {
          computedDistanceM: (a._sum.distanceKm ?? 0) * 1000,
          runCount: a._count._all,
          firstUseDate: a._min.startDate?.toISOString() ?? null,
          lastUseDate: a._max.startDate?.toISOString() ?? null,
        },
      ]),
    );

    return gear.map((g) => {
      const agg = aggByGearId.get(g.id);
      return {
        id: g.id,
        name: g.name,
        brandName: g.brandName,
        modelName: g.modelName,
        distance: g.distance,
        computedDistanceM: agg?.computedDistanceM ?? 0,
        runCount: agg?.runCount ?? 0,
        firstUseDate: agg?.firstUseDate ?? null,
        lastUseDate: agg?.lastUseDate ?? null,
        primary: g.primary,
        retired: g.retired,
      };
    });
  }
}
