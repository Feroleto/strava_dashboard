import { BadRequestException } from '@nestjs/common';

// Manual validation, no class-validator — same convention as exercises/dto.ts

export function parseSearchQuery(q?: string): string {
  const trimmed = q?.trim();
  if (!trimmed) {
    throw new BadRequestException('q is required');
  }
  return trimmed;
}

export interface CreateCustomFoodInput {
  name: string;
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber?: number;
  sodium?: number;
  // set when a barcode scan found no match anywhere (local + Open Food
  // Facts) and the user cadastra manually while still linking it to the
  // scanned code — future scans of the same barcode resolve locally
  externalId?: string;
}

// source/createdByUserId are deliberately not accepted here — the controller
// always sets them from the authenticated user, never trusts the body
export function parseCreateCustomFoodInput(body: unknown): CreateCustomFoodInput {
  if (typeof body !== 'object' || body === null) {
    throw new BadRequestException('Request body must be an object');
  }

  const { name, kcal, protein, carbs, fat, fiber, sodium, externalId } =
    body as Record<string, unknown>;

  if (typeof name !== 'string' || name.trim().length === 0) {
    throw new BadRequestException('name is required');
  }

  return {
    name: name.trim(),
    kcal: parseNonNegativeNumber('kcal', kcal),
    protein: parseNonNegativeNumber('protein', protein),
    carbs: parseNonNegativeNumber('carbs', carbs),
    fat: parseNonNegativeNumber('fat', fat),
    fiber: parseOptionalNonNegativeNumber('fiber', fiber),
    sodium: parseOptionalNonNegativeNumber('sodium', sodium),
    externalId: parseOptionalString('externalId', externalId),
  };
}

function parseNonNegativeNumber(field: string, value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    throw new BadRequestException(`${field} must be a non-negative number`);
  }
  return value;
}

function parseOptionalNonNegativeNumber(field: string, value: unknown): number | undefined {
  if (value === undefined || value === null) return undefined;
  return parseNonNegativeNumber(field, value);
}

function parseOptionalString(field: string, value: unknown): string | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new BadRequestException(`${field} must be a non-empty string`);
  }
  return value.trim();
}
