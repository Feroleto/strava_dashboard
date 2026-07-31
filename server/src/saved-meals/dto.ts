import { BadRequestException } from '@nestjs/common';
import { MealType } from '@prisma/client';

// Manual validation, no class-validator — same convention as foods/dto.ts,
// food-logs/dto.ts, workout-templates/dto.ts

export interface CreateSavedMealItemInput {
  foodId: string;
  quantity: number;
}

// shared by create (items required, defaults to []) and update (items
// optional — presence means "replace the whole list", see
// parseUpdateSavedMealInput), same undefined-vs-array semantics as
// workout-templates/dto.ts parseTemplateExercises
function parseSavedMealItems(value: unknown): CreateSavedMealItemInput[] {
  if (!Array.isArray(value)) {
    throw new BadRequestException('items must be an array');
  }
  return value.map((raw, idx) => {
    if (typeof raw !== 'object' || raw === null) {
      throw new BadRequestException(`items[${idx}] must be an object`);
    }
    const { foodId, quantity } = raw as Record<string, unknown>;
    if (typeof foodId !== 'string' || foodId.trim().length === 0) {
      throw new BadRequestException(`items[${idx}].foodId is required`);
    }
    if (typeof quantity !== 'number' || !Number.isFinite(quantity) || quantity <= 0) {
      throw new BadRequestException(`items[${idx}].quantity must be a positive number`);
    }
    return { foodId, quantity };
  });
}

export interface CreateSavedMealInput {
  name: string;
  items: CreateSavedMealItemInput[];
}

export function parseCreateSavedMealInput(body: unknown): CreateSavedMealInput {
  if (typeof body !== 'object' || body === null) {
    throw new BadRequestException('Request body must be an object');
  }
  const { name, items } = body as Record<string, unknown>;

  if (typeof name !== 'string' || name.trim().length === 0) {
    throw new BadRequestException('name is required');
  }

  return {
    name: name.trim(),
    items: items !== undefined && items !== null ? parseSavedMealItems(items) : [],
  };
}

export interface UpdateSavedMealInput {
  name?: string;
  // undefined = leave the item list untouched; an array (including [])
  // replaces it wholesale — same semantics as UpdateTemplateInput.exercises
  items?: CreateSavedMealItemInput[];
}

export function parseUpdateSavedMealInput(body: unknown): UpdateSavedMealInput {
  if (typeof body !== 'object' || body === null) {
    throw new BadRequestException('Request body must be an object');
  }
  const { name, items } = body as Record<string, unknown>;

  const result: UpdateSavedMealInput = {};
  if (name !== undefined) {
    if (typeof name !== 'string' || name.trim().length === 0) {
      throw new BadRequestException('name must be a non-empty string');
    }
    result.name = name.trim();
  }
  if (items !== undefined) {
    result.items = parseSavedMealItems(items);
  }
  return result;
}

export interface ApplySavedMealInput {
  mealType: MealType;
  loggedAt: Date;
}

// same mealType/loggedAt validation as food-logs/dto.ts parseCreateFoodLogInput
export function parseApplySavedMealInput(body: unknown): ApplySavedMealInput {
  if (typeof body !== 'object' || body === null) {
    throw new BadRequestException('Request body must be an object');
  }
  const { mealType, loggedAt } = body as Record<string, unknown>;

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

  return { mealType: mealType as MealType, loggedAt: parsedLoggedAt };
}
