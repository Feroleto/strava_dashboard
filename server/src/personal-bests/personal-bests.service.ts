import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

export interface PersonalBestRecord {
  name: string;
  rank: number;
  movingTime: number;
  distance: number;
  startDate: Date;
  activityId: string;
  prRank: number | null;
}

export interface BestEffortHistoryItem {
  id: string;
  distance: number;
  movingTime: number;
  elapsedTime: number;
  startDate: Date;
  prRank: number | null;
  activityId: string;
}

@Injectable()
export class PersonalBestsService {
  private readonly prisma: PrismaClient;

  constructor(private readonly config: ConfigService) {
    const adapter = new PrismaPg({
      connectionString: this.config.get<string>('DATABASE_URL'),
    });
    this.prisma = new PrismaClient({ adapter });
  }

  // top N fastest moving_times per distance name — records are always
  // derived here rather than stored, so they stay correct if activities are
  // reprocessed or deleted. Strava's pr_rank can't be used for this: it is
  // frozen at upload time ("was a PR back then"), so several efforts of the
  // same name carry pr_rank = 1. ROW_NUMBER() is cast to int because Postgres
  // returns bigint, which Prisma would surface as BigInt and break JSON
  // serialization of the response
  async topRecords(userId: string, topN = 3): Promise<PersonalBestRecord[]> {
    return this.prisma.$queryRaw<PersonalBestRecord[]>`
      SELECT name, rank, "movingTime", distance, "startDate", "activityId", "prRank"
      FROM (
        SELECT
          be.name,
          ROW_NUMBER() OVER (
            PARTITION BY be.name
            ORDER BY be."moving_time" ASC, be."start_date" ASC
          )::int AS rank,
          be."moving_time" AS "movingTime",
          be.distance,
          be."start_date" AS "startDate",
          be."activityId" AS "activityId",
          be."pr_rank" AS "prRank"
        FROM "activity_best_efforts" be
        JOIN "activities" a ON a.id = be."activityId"
        WHERE a."userId" = ${userId}
      ) ranked
      WHERE rank <= ${topN}
      ORDER BY name, rank
    `;
  }

  async history(userId: string, name: string): Promise<BestEffortHistoryItem[]> {
    return this.prisma.activityBestEffort.findMany({
      where: { name, activity: { userId } },
      orderBy: { startDate: 'asc' },
      select: {
        id: true,
        distance: true,
        movingTime: true,
        elapsedTime: true,
        startDate: true,
        prRank: true,
        activityId: true,
      },
    });
  }
}
