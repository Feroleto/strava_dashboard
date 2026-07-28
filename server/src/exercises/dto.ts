import { BadRequestException } from '@nestjs/common';
import {
  Equipment,
  ExerciseForce,
  ExerciseLevel,
  ExerciseMechanic,
  MuscleGroup,
} from '@prisma/client';

// Manual validation, no class-validator (not used anywhere in this project) —
// same convention as UsersController.update / lap-editor/dto.ts

const MAX_LIMIT = 50;
const MAX_PAGE = 1_000_000;
const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;

export function parseExercisePagination(
  page?: string,
  limit?: string,
): { page: number; limit: number } {
  return {
    page: parseIntParam('page', page, 1, MAX_PAGE) ?? DEFAULT_PAGE,
    limit: parseIntParam('limit', limit, 1, MAX_LIMIT) ?? DEFAULT_LIMIT,
  };
}

function parseIntParam(
  name: string,
  value: string | undefined,
  min: number,
  max: number,
): number | undefined {
  if (value === undefined) return undefined;

  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < min || parsed > max) {
    throw new BadRequestException(
      `Invalid ${name}. Expected an integer between ${min} and ${max}.`,
    );
  }

  return parsed;
}

export interface ExerciseFilters {
  search?: string;
  muscle?: MuscleGroup;
  /** OR filter (primaryMuscles hasSome) — the coarse mobile group chips (e.g.
   * "Pernas") map to several MuscleGroup enum values, unlike the single-value
   * `muscle` filter above, which stays as-is for existing/other callers */
  muscles?: MuscleGroup[];
  equipment?: Equipment;
}

export function parseExerciseFilters(
  search?: string,
  muscle?: string,
  equipment?: string,
  muscles?: string,
): ExerciseFilters {
  if (muscle && !Object.values(MuscleGroup).includes(muscle as MuscleGroup)) {
    throw new BadRequestException(
      `Invalid muscle. Expected one of: ${Object.values(MuscleGroup).join(', ')}`,
    );
  }
  if (equipment && !Object.values(Equipment).includes(equipment as Equipment)) {
    throw new BadRequestException(
      `Invalid equipment. Expected one of: ${Object.values(Equipment).join(', ')}`,
    );
  }
  let parsedMuscles: MuscleGroup[] | undefined;
  if (muscles) {
    parsedMuscles = muscles.split(',').map((m) => {
      const trimmed = m.trim();
      if (!Object.values(MuscleGroup).includes(trimmed as MuscleGroup)) {
        throw new BadRequestException(
          `Invalid muscles. Expected a comma-separated list of: ${Object.values(MuscleGroup).join(', ')}`,
        );
      }
      return trimmed as MuscleGroup;
    });
  }

  return {
    search: search?.trim() || undefined,
    muscle: muscle as MuscleGroup | undefined,
    muscles: parsedMuscles,
    equipment: equipment as Equipment | undefined,
  };
}

export interface CreateExerciseInput {
  name: string;
  force?: ExerciseForce;
  level?: ExerciseLevel;
  mechanic?: ExerciseMechanic;
  equipment?: Equipment;
  primaryMuscles: MuscleGroup[];
  secondaryMuscles: MuscleGroup[];
  instructions: string[];
  imageUrls: string[];
}

// source/createdByUserId are deliberately not accepted here — the controller
// always sets them from the authenticated user, never trusts the body
export function parseCreateExerciseInput(body: unknown): CreateExerciseInput {
  if (typeof body !== 'object' || body === null) {
    throw new BadRequestException('Request body must be an object');
  }

  const {
    name,
    force,
    level,
    mechanic,
    equipment,
    primaryMuscles,
    secondaryMuscles,
    instructions,
    imageUrls,
  } = body as Record<string, unknown>;

  if (typeof name !== 'string' || name.trim().length === 0) {
    throw new BadRequestException('name is required');
  }

  return {
    name: name.trim(),
    force: parseOptionalEnum('force', force, ExerciseForce),
    level: parseOptionalEnum('level', level, ExerciseLevel),
    mechanic: parseOptionalEnum('mechanic', mechanic, ExerciseMechanic),
    equipment: parseOptionalEnum('equipment', equipment, Equipment),
    primaryMuscles: parseOptionalEnumArray('primaryMuscles', primaryMuscles, MuscleGroup),
    secondaryMuscles: parseOptionalEnumArray('secondaryMuscles', secondaryMuscles, MuscleGroup),
    instructions: parseOptionalStringArray('instructions', instructions),
    imageUrls: parseOptionalStringArray('imageUrls', imageUrls),
  };
}

function parseOptionalEnum<T extends string>(
  field: string,
  value: unknown,
  enumObj: Record<string, T>,
): T | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== 'string' || !Object.values(enumObj).includes(value as T)) {
    throw new BadRequestException(
      `Invalid ${field}. Expected one of: ${Object.values(enumObj).join(', ')}`,
    );
  }
  return value as T;
}

function parseOptionalEnumArray<T extends string>(
  field: string,
  value: unknown,
  enumObj: Record<string, T>,
): T[] {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value) || value.some((v) => typeof v !== 'string')) {
    throw new BadRequestException(`${field} must be an array of strings`);
  }
  for (const v of value) {
    if (!Object.values(enumObj).includes(v as T)) {
      throw new BadRequestException(
        `Invalid ${field} value "${v}". Expected one of: ${Object.values(enumObj).join(', ')}`,
      );
    }
  }
  return value as T[];
}

function parseOptionalStringArray(field: string, value: unknown): string[] {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value) || value.some((v) => typeof v !== 'string')) {
    throw new BadRequestException(`${field} must be an array of strings`);
  }
  return value as string[];
}
