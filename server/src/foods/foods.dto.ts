import { BadRequestException } from '@nestjs/common';
import { SERVING_UNITS, isServingUnit, type ServingUnit } from './serving-units';

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
  // optional household measure, always as a pair (see parseServingPair)
  servingLabel?: ServingUnit;
  servingGrams?: number;
}

// source/createdByUserId are deliberately not accepted here — the controller
// always sets them from the authenticated user, never trusts the body
export function parseCreateCustomFoodInput(body: unknown): CreateCustomFoodInput {
  if (typeof body !== 'object' || body === null) {
    throw new BadRequestException('Request body must be an object');
  }

  const { name, kcal, protein, carbs, fat, fiber, sodium, externalId, servingLabel, servingGrams } =
    body as Record<string, unknown>;

  if (typeof name !== 'string' || name.trim().length === 0) {
    throw new BadRequestException('name is required');
  }

  const serving = parseServingPair(servingLabel, servingGrams);

  return {
    name: name.trim(),
    kcal: parseNonNegativeNumber('kcal', kcal),
    protein: parseNonNegativeNumber('protein', protein),
    carbs: parseNonNegativeNumber('carbs', carbs),
    fat: parseNonNegativeNumber('fat', fat),
    fiber: parseOptionalNonNegativeNumber('fiber', fiber),
    sodium: parseOptionalNonNegativeNumber('sodium', sodium),
    externalId: parseOptionalString('externalId', externalId),
    servingLabel: serving.label,
    servingGrams: serving.grams,
  };
}

// servingLabel/servingGrams only make sense together — a label with no weight
// can't be converted to grams, and a weight with no label has nothing to
// render. Either both are present or neither is.
export function parseServingPair(
  label: unknown,
  grams: unknown,
): { label?: ServingUnit; grams?: number } {
  const hasLabel = label !== undefined && label !== null;
  const hasGrams = grams !== undefined && grams !== null;

  if (!hasLabel && !hasGrams) return {};
  if (hasLabel !== hasGrams) {
    throw new BadRequestException('servingLabel and servingGrams must be provided together');
  }
  if (!isServingUnit(label)) {
    throw new BadRequestException(
      `Invalid servingLabel. Expected one of: ${SERVING_UNITS.join(', ')}`,
    );
  }
  if (typeof grams !== 'number' || !Number.isFinite(grams) || grams <= 0) {
    throw new BadRequestException('servingGrams must be a positive number');
  }
  return { label, grams };
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
