import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma, PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import type { MealType } from '@prisma/client';
import type { CreateMealInput, ReorderMealsInput, UpdateMealInput } from './dto';

export interface MealItem {
  id: string;
  type: MealType;
  order: number;
  /** logs pointing at this meal across *every* day — drives the delete confirmation */
  logCount: number;
}

// the five slots the diet UI rendered hardcoded before meals were
// configurable, in display order (SNACK sits before DINNER, unlike the
// declaration order of the MealType enum)
// literals rather than the MealType runtime object on purpose: this module is
// pulled in by FoodLogsService/SavedMealsService, whose tests mock
// '@prisma/client' wholesale — a value-level enum read would make every one of
// those mocks have to know about MealType. tsc still catches a typo here.
const DEFAULT_MEAL_TYPES: MealType[] = ['BREAKFAST', 'LUNCH', 'SNACK', 'DINNER', 'SUPPER'];

// arbitrary but deliberate: the overview card is a flat list with no
// scrolling of its own, and unbounded rows behind a single button is how it
// stops being usable
const MAX_MEALS = 12;

const MEAL_SELECT = {
  id: true,
  type: true,
  order: true,
  _count: { select: { foodLogs: true } },
} satisfies Prisma.MealSelect;

type MealRow = { id: string; type: MealType; order: number; _count: { foodLogs: number } };

function toItem(meal: MealRow): MealItem {
  return { id: meal.id, type: meal.type, order: meal.order, logCount: meal._count.foodLogs };
}

@Injectable()
export class MealsService {
  private readonly prisma: PrismaClient;

  constructor(private readonly config: ConfigService) {
    const adapter = new PrismaPg({
      connectionString: this.config.get<string>('DATABASE_URL'),
    });
    this.prisma = new PrismaClient({ adapter });
  }

  // Deliberately a GET that can write: a user with no meals yet gets the five
  // defaults seeded here rather than at signup, which would mean touching both
  // creation paths (AuthService.register and StravaAuthService.handleCallback)
  // and *still* needing this as a backfill for everyone created before meals
  // existed. Never fires again once the user has at least one meal — and
  // remove() refuses to delete the last one, so a deliberately emptied list
  // can't be resurrected here.
  async list(userId: string): Promise<MealItem[]> {
    const meals = await this.query(userId);
    if (meals.length > 0) return meals;

    await this.ensureDefaults(userId);
    return this.query(userId);
  }

  async create(userId: string, input: CreateMealInput): Promise<MealItem[]> {
    // one read serves both the cap and the append position
    const existing = await this.prisma.meal.findMany({
      where: { userId },
      select: { order: true },
    });
    if (existing.length >= MAX_MEALS) {
      throw new BadRequestException(`A day can have at most ${MAX_MEALS} meals`);
    }
    const maxOrder = existing.reduce((max, m) => Math.max(max, m.order), 0);

    await this.prisma.meal.create({
      data: { userId, type: input.type, order: maxOrder + 1 },
    });
    return this.query(userId);
  }

  async update(userId: string, id: string, input: UpdateMealInput): Promise<MealItem[]> {
    await this.assertOwned(userId, id);
    await this.prisma.meal.update({ where: { id }, data: { type: input.type } });
    return this.query(userId);
  }

  // The client sends the full ordered id list and the server assigns
  // order = idx + 1, same "order derived from array position, never trusted
  // from the client" convention as WorkoutTemplatesService.update. Requiring
  // the id set to match exactly is what makes that safe: a partial list would
  // silently renumber some meals on top of others.
  async reorder(userId: string, input: ReorderMealsInput): Promise<MealItem[]> {
    const current = await this.prisma.meal.findMany({
      where: { userId },
      select: { id: true },
    });
    const currentIds = new Set(current.map((m) => m.id));
    if (input.ids.length !== currentIds.size || input.ids.some((id) => !currentIds.has(id))) {
      throw new BadRequestException('ids must contain exactly the current meals, once each');
    }

    await this.prisma.$transaction(
      input.ids.map((id, idx) =>
        this.prisma.meal.update({ where: { id }, data: { order: idx + 1 } }),
      ),
    );
    return this.query(userId);
  }

  // cascades to every FoodLog pointing at this meal, on every day — the UI
  // confirms with the count from MealItem.logCount before calling this
  async remove(userId: string, id: string): Promise<MealItem[]> {
    await this.assertOwned(userId, id);

    const count = await this.prisma.meal.count({ where: { userId } });
    if (count <= 1) {
      throw new BadRequestException('A day must have at least one meal');
    }

    await this.prisma.meal.delete({ where: { id } });
    return this.query(userId);
  }

  // public so FoodLogsService/SavedMealsService can check a mealId coming off
  // the wire. Unlike the closed MealType enum it replaced, a meal id is a
  // guessable string: without this, POST /food-logs could attach a log to
  // another user's meal (existence oracle, and the row would vanish when that
  // user deleted the meal). 404 rather than 403, same as everywhere else here.
  async assertOwned(userId: string, id: string): Promise<void> {
    const meal = await this.prisma.meal.findFirst({
      where: { id, userId },
      select: { id: true },
    });
    if (!meal) {
      throw new NotFoundException(`Meal ${id} not found`);
    }
  }

  private async query(userId: string): Promise<MealItem[]> {
    const meals = await this.prisma.meal.findMany({
      where: { userId },
      orderBy: { order: 'asc' },
      select: MEAL_SELECT,
    });
    return meals.map(toItem);
  }

  // The advisory lock is what keeps a double GET (React StrictMode's double
  // mount, a double tap, an offline-then-online retry) from seeding ten meals:
  // both callers would otherwise see count === 0 under Read Committed and both
  // insert. A @@unique([userId, type]) can't stand in for it — duplicate types
  // are a feature here.
  private async ensureDefaults(userId: string): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${userId}))`;
      if ((await tx.meal.count({ where: { userId } })) > 0) return;
      await tx.meal.createMany({
        data: DEFAULT_MEAL_TYPES.map((type, idx) => ({ userId, type, order: idx + 1 })),
      });
    });
  }
}
