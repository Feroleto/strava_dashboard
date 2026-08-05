import { BadRequestException } from '@nestjs/common';
import { MealType } from '@prisma/client';

// Manual validation, no class-validator — same convention as foods/dto.ts,
// food-logs/dto.ts, saved-meals/dto.ts

export interface CreateMealInput {
  type: MealType;
}

export interface UpdateMealInput {
  type: MealType;
}

export interface ReorderMealsInput {
  ids: string[];
}

function parseMealType(value: unknown): MealType {
  if (typeof value !== 'string' || !Object.values(MealType).includes(value as MealType)) {
    throw new BadRequestException(
      `Invalid type. Expected one of: ${Object.values(MealType).join(', ')}`,
    );
  }
  return value as MealType;
}

export function parseCreateMealInput(body: unknown): CreateMealInput {
  if (typeof body !== 'object' || body === null) {
    throw new BadRequestException('Request body must be an object');
  }
  const { type } = body as Record<string, unknown>;
  return { type: parseMealType(type) };
}

// PATCH only ever renames a meal — `order` is not editable here, reordering
// goes through PUT /meals/order with the full list (moving one meal renumbers
// several, so a per-row order write would force the client to fan out N
// requests and invent the numbering itself)
export function parseUpdateMealInput(body: unknown): UpdateMealInput {
  if (typeof body !== 'object' || body === null) {
    throw new BadRequestException('Request body must be an object');
  }
  const { type } = body as Record<string, unknown>;
  return { type: parseMealType(type) };
}

export function parseReorderMealsInput(body: unknown): ReorderMealsInput {
  if (typeof body !== 'object' || body === null) {
    throw new BadRequestException('Request body must be an object');
  }
  const { ids } = body as Record<string, unknown>;

  if (!Array.isArray(ids)) {
    throw new BadRequestException('ids must be an array');
  }
  if (ids.length === 0) {
    throw new BadRequestException('ids must not be empty');
  }
  const parsed = ids.map((raw, idx) => {
    if (typeof raw !== 'string' || raw.trim().length === 0) {
      throw new BadRequestException(`ids[${idx}] must be a non-empty string`);
    }
    return raw.trim();
  });
  if (new Set(parsed).size !== parsed.length) {
    throw new BadRequestException('ids must not contain duplicates');
  }

  return { ids: parsed };
}
