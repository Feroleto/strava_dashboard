import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

export interface ActivityListItem {
  id: string;
  name: string;
  type: string;
  workoutType: string;
  startDate: Date;
  distanceKm: number | null;
  movingTimeSec: number;
  paceRawSecKm: number | null;
  elevationGainM: number | null;
  averageBpm: number | null;
}

@Injectable()
export class ActivitiesService {
  private readonly prisma: PrismaClient;

  constructor(private readonly config: ConfigService) {
    const adapter = new PrismaPg({
      connectionString: this.config.get<string>('DATABASE_URL'),
    });
    this.prisma = new PrismaClient({ adapter });
  }

  async list(
    userId: string,
    page = 1,
    limit = 20,
  ): Promise<{ items: ActivityListItem[]; total: number; page: number; limit: number }> {
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      this.prisma.activity.findMany({
        where: { userId },
        orderBy: { startDate: 'desc' },
        skip,
        take: limit,
        select: {
          id: true,
          name: true,
          type: true,
          workoutType: true,
          startDate: true,
          distanceKm: true,
          movingTimeSec: true,
          paceRawSecKm: true,
          elevationGainM: true,
          averageBpm: true,
        },
      }),
      this.prisma.activity.count({ where: { userId } }),
    ]);

    return { items, total, page, limit };
  }
}