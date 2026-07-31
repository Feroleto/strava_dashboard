import { BadRequestException } from '@nestjs/common';
import { MealType } from '@prisma/client';

// Manual validation, no class-validator — same convention as foods/dto.ts

export interface CreateFoodLogInput {
  foodId: string;
  quantity: number;
  mealType: MealType;
  loggedAt: Date;
}

export function parseCreateFoodLogInput(body: unknown): CreateFoodLogInput {
  if (typeof body !== 'object' || body === null) {
    throw new BadRequestException('Request body must be an object');
  }

  const { foodId, quantity, mealType, loggedAt } = body as Record<string, unknown>;

  if (typeof foodId !== 'string' || foodId.trim().length === 0) {
    throw new BadRequestException('foodId is required');
  }
  if (typeof quantity !== 'number' || !Number.isFinite(quantity) || quantity <= 0) {
    throw new BadRequestException('quantity must be a positive number');
  }
  if (typeof mealType !== 'string' || !Object.values(MealType).includes(mealType as MealType)) {
    throw new BadRequestException(
      `Invalid mealType. Expected one of: ${Object.values(MealType).join(', ')}`,
    );
  }
  if (typeof loggedAt !== 'string') {
    throw new BadRequestException('loggedAt is required');
  }
  const parsedLoggedAt = new Date(loggedAt);
  if (Number.isNaN(parsedLoggedAt.getTime())) {
    throw new BadRequestException('loggedAt must be a valid ISO date string');
  }

  return { foodId: foodId.trim(), quantity, mealType: mealType as MealType, loggedAt: parsedLoggedAt };
}

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

// day boundary is computed in UTC — same accepted imprecision already
// documented for GET /activities/weekly-distance (see CLAUDE.md "Problemas
// conhecidos"); a log made between 21h and midnight BRT can land on the
// "wrong" day
export function parseDateQuery(date?: string): string {
  if (!date || !DATE_PATTERN.test(date)) {
    throw new BadRequestException('date must be in YYYY-MM-DD format');
  }
  return date;
}

const ALLOWED_HISTORY_DAYS = [7, 14];

export function parseDaysQuery(days?: string): number {
  const parsed = Number(days);
  if (!ALLOWED_HISTORY_DAYS.includes(parsed)) {
    throw new BadRequestException(
      `days must be one of: ${ALLOWED_HISTORY_DAYS.join(', ')}`,
    );
  }
  return parsed;
}
