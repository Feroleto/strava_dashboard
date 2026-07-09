import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaClient, WorkoutType } from '@prisma/client';
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
  maxBpm: number | null;
  averageCadence: number | null;
}

export interface ActivityLapItem {
  id: string;
  lapIndex: number;
  lapType: string;
  startSec: number;
  endSec: number;
  totalDurationSec: number;
  movingDurationSec: number;
  distanceM: number;
  avgPaceSecKm: number;
  avgHr: number;
  elevGainM: number;
  avgGradePercent: number | null;
  vam: number | null;
  avgCadence: number | null;
}

export interface WeeklyDistancePoint {
  weekStart: string;
  totalKm: number;
  totalTimeSec: number;
}

export interface ActivityDetail {
  id: string;
  name: string;
  type: string;
  sportType: string | null;
  workoutType: string;
  startDate: Date;
  distanceKm: number | null;
  movingTimeSec: number;
  paceRawSecKm: number | null;
  elevationGainM: number | null;
  averageBpm: number | null;
  maxBpm: number | null;
  averageCadence: number | null;
  summaryPolyline: string | null;
  laps: ActivityLapItem[];
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

  private buildWhere(
    userId: string,
    workoutType?: WorkoutType,
    startDate?: Date,
    endDate?: Date,
  ) {
    return {
      userId,
      ...(workoutType && { workoutType }),
      ...((startDate || endDate) && {
        startDate: {
          ...(startDate && { gte: startDate }),
          ...(endDate && { lte: endDate }),
        },
      }),
    };
  }

  async list(
    userId: string,
    page = 1,
    limit = 20,
    workoutType?: WorkoutType,
    startDate?: Date,
    endDate?: Date,
  ): Promise<{
    items: ActivityListItem[];
    total: number;
    page: number;
    limit: number;
  }> {
    const skip = (page - 1) * limit;
    const where = this.buildWhere(userId, workoutType, startDate, endDate);

    const [items, total] = await Promise.all([
      this.prisma.activity.findMany({
        where,
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
          maxBpm: true,
          averageCadence: true,
        },
      }),
      this.prisma.activity.count({ where }),
    ]);

    return { items, total, page, limit };
  }

  async weeklyDistance(
    userId: string,
    workoutType?: WorkoutType,
    startDate?: Date,
    endDate?: Date,
  ): Promise<{ weeks: WeeklyDistancePoint[] }> {
    const activities = await this.prisma.activity.findMany({
      where: this.buildWhere(userId, workoutType, startDate, endDate),
      select: { startDate: true, distanceKm: true, movingTimeSec: true },
    });

    if (activities.length === 0) return { weeks: [] };

    const totals = new Map<number, { totalKm: number; totalTimeSec: number }>();
    for (const activity of activities) {
      const week = this.weekStartUtc(activity.startDate).getTime();
      const entry = totals.get(week) ?? { totalKm: 0, totalTimeSec: 0 };
      entry.totalKm += activity.distanceKm ?? 0;
      entry.totalTimeSec += activity.movingTimeSec;
      totals.set(week, entry);
    }

    const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
    const weekKeys = [...totals.keys()];
    const firstWeek = Math.min(...weekKeys);
    const lastWeek = Math.max(...weekKeys);

    const weeks: WeeklyDistancePoint[] = [];
    for (let week = firstWeek; week <= lastWeek; week += WEEK_MS) {
      const entry = totals.get(week) ?? { totalKm: 0, totalTimeSec: 0 };
      weeks.push({
        weekStart: new Date(week).toISOString().slice(0, 10),
        totalKm: entry.totalKm,
        totalTimeSec: entry.totalTimeSec,
      });
    }

    return { weeks };
  }

  private weekStartUtc(date: Date): Date {
    const day = new Date(
      Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
    );
    const offsetFromMonday = (day.getUTCDay() + 6) % 7;
    day.setUTCDate(day.getUTCDate() - offsetFromMonday);
    return day;
  }

  async findById(userId: string, id: string): Promise<ActivityDetail | null> {
    return this.prisma.activity.findFirst({
      where: { id, userId },
      select: {
        id: true,
        name: true,
        type: true,
        sportType: true,
        workoutType: true,
        startDate: true,
        distanceKm: true,
        movingTimeSec: true,
        paceRawSecKm: true,
        elevationGainM: true,
        averageBpm: true,
        maxBpm: true,
        averageCadence: true,
        summaryPolyline: true,
        laps: {
          orderBy: { lapIndex: 'asc' },
          select: {
            id: true,
            lapIndex: true,
            lapType: true,
            startSec: true,
            endSec: true,
            totalDurationSec: true,
            movingDurationSec: true,
            distanceM: true,
            avgPaceSecKm: true,
            avgHr: true,
            elevGainM: true,
            avgGradePercent: true,
            vam: true,
            avgCadence: true,
          },
        },
      },
    });
  }
}
