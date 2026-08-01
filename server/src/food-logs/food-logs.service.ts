import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma, PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import type { CreateFoodLogInput, UpdateFoodLogInput } from './food-logs.dto';
import type { FoodListItem } from '../foods/foods.service';

export interface FoodLogItem {
  id: string;
  quantity: number;
  enteredAsServing: boolean;
  mealType: string;
  loggedAt: Date;
  food: FoodListItem;
}

export interface DailySummary {
  totalKcal: number;
  totalProtein: number;
  totalCarbs: number;
  totalFat: number;
}

export interface DailyHistoryPoint extends DailySummary {
  date: string;
}

const FOOD_LOG_SELECT = {
  id: true,
  quantity: true,
  enteredAsServing: true,
  mealType: true,
  loggedAt: true,
  food: {
    select: {
      id: true,
      name: true,
      brand: true,
      source: true,
      imageUrl: true,
      kcal: true,
      protein: true,
      carbs: true,
      fat: true,
      fiber: true,
      sodium: true,
      servingLabel: true,
      servingGrams: true,
    },
  },
} satisfies Prisma.FoodLogSelect;

function dayBoundaries(date: string): { start: Date; end: Date } {
  const start = new Date(`${date}T00:00:00.000Z`);
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return { start, end };
}

@Injectable()
export class FoodLogsService {
  private readonly prisma: PrismaClient;

  constructor(private readonly config: ConfigService) {
    const adapter = new PrismaPg({
      connectionString: this.config.get<string>('DATABASE_URL'),
    });
    this.prisma = new PrismaClient({ adapter });
  }

  async create(userId: string, input: CreateFoodLogInput): Promise<FoodLogItem> {
    return this.prisma.foodLog.create({
      data: {
        userId,
        foodId: input.foodId,
        quantity: input.quantity,
        enteredAsServing: input.enteredAsServing,
        mealType: input.mealType,
        loggedAt: input.loggedAt,
      },
      select: FOOD_LOG_SELECT,
    });
  }

  // updateMany (not update) for the same reason as remove() below: ownership
  // lives in the where clause, so another user's log is a 404, never a 403
  async update(userId: string, id: string, input: UpdateFoodLogInput): Promise<FoodLogItem> {
    const result = await this.prisma.foodLog.updateMany({
      where: { id, userId },
      data: { quantity: input.quantity, enteredAsServing: input.enteredAsServing },
    });
    if (result.count === 0) {
      throw new NotFoundException(`Food log ${id} not found`);
    }
    // updateMany can't select, so read the row back in the shape callers expect
    const updated = await this.prisma.foodLog.findUniqueOrThrow({
      where: { id },
      select: FOOD_LOG_SELECT,
    });
    return updated;
  }

  async findByDate(userId: string, date: string): Promise<FoodLogItem[]> {
    const { start, end } = dayBoundaries(date);
    return this.prisma.foodLog.findMany({
      where: { userId, loggedAt: { gte: start, lt: end } },
      orderBy: { loggedAt: 'asc' },
      select: FOOD_LOG_SELECT,
    });
  }

  // deleteMany (not delete) — folds ownership into the where clause itself,
  // same 404-not-403 convention as assertOwnedWorkout in workouts.service.ts
  async remove(userId: string, id: string): Promise<void> {
    const result = await this.prisma.foodLog.deleteMany({ where: { id, userId } });
    if (result.count === 0) {
      throw new NotFoundException(`Food log ${id} not found`);
    }
  }

  // mirror of PersonalBestsService.topRecords: tagged-template $queryRaw,
  // parameters interpolated (Prisma parameterizes these safely). No ::int
  // cast needed here (unlike ROW_NUMBER()/COUNT) — every summed column is
  // Postgres double precision, which Prisma already maps to a JS number.
  async getDailySummary(userId: string, date: string): Promise<DailySummary> {
    const { start, end } = dayBoundaries(date);
    const rows = await this.prisma.$queryRaw<DailySummary[]>`
      SELECT
        COALESCE(SUM(f.kcal * fl.quantity / 100), 0) AS "totalKcal",
        COALESCE(SUM(f.protein * fl.quantity / 100), 0) AS "totalProtein",
        COALESCE(SUM(f.carbs * fl.quantity / 100), 0) AS "totalCarbs",
        COALESCE(SUM(f.fat * fl.quantity / 100), 0) AS "totalFat"
      FROM "food_logs" fl
      JOIN "foods" f ON f.id = fl."food_id"
      WHERE fl."user_id" = ${userId} AND fl."logged_at" >= ${start} AND fl."logged_at" < ${end}
    `;
    return rows[0] ?? { totalKcal: 0, totalProtein: 0, totalCarbs: 0, totalFat: 0 };
  }

  // zero-fills days with no logs via generate_series, so callers never have
  // to reconcile a sparse result against the requested date range themselves
  async getHistory(userId: string, days: number): Promise<DailyHistoryPoint[]> {
    const end = new Date();
    end.setUTCHours(0, 0, 0, 0);
    const start = new Date(end.getTime() - (days - 1) * 24 * 60 * 60 * 1000);

    const rows = await this.prisma.$queryRaw<
      { date: Date; totalKcal: number; totalProtein: number; totalCarbs: number; totalFat: number }[]
    >`
      SELECT
        d::date AS date,
        COALESCE(SUM(f.kcal * fl.quantity / 100), 0) AS "totalKcal",
        COALESCE(SUM(f.protein * fl.quantity / 100), 0) AS "totalProtein",
        COALESCE(SUM(f.carbs * fl.quantity / 100), 0) AS "totalCarbs",
        COALESCE(SUM(f.fat * fl.quantity / 100), 0) AS "totalFat"
      FROM generate_series(${start}::date, ${end}::date, '1 day') d
      LEFT JOIN "food_logs" fl
        ON fl."user_id" = ${userId}
        AND fl."logged_at" >= d
        AND fl."logged_at" < d + interval '1 day'
      LEFT JOIN "foods" f ON f.id = fl."food_id"
      GROUP BY d
      ORDER BY d ASC
    `;

    return rows.map((r) => ({
      date: r.date.toISOString().slice(0, 10),
      totalKcal: r.totalKcal,
      totalProtein: r.totalProtein,
      totalCarbs: r.totalCarbs,
      totalFat: r.totalFat,
    }));
  }
}
