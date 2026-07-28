import { BadRequestException } from '@nestjs/common';

// Manual validation, no class-validator — same convention as
// UsersController.update / exercises/dto.ts / workouts/dto.ts

const MIN_TARGET_SETS = 1;
const MAX_TARGET_SETS = 20;
const MIN_TARGET_REPS = 1;
const MAX_TARGET_REPS = 100;

export interface TemplateExerciseTargets {
  targetSets?: number;
  targetRepsMin?: number;
  targetRepsMax?: number;
}

function parseOptionalInt(
  field: string,
  value: unknown,
  min: number,
  max: number,
): number | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== 'number' || !Number.isInteger(value) || value < min || value > max) {
    throw new BadRequestException(
      `${field} must be an integer between ${min} and ${max}`,
    );
  }
  return value;
}

function parseTargets(body: Record<string, unknown>): TemplateExerciseTargets {
  const targetSets = parseOptionalInt(
    'targetSets',
    body.targetSets,
    MIN_TARGET_SETS,
    MAX_TARGET_SETS,
  );
  const targetRepsMin = parseOptionalInt(
    'targetRepsMin',
    body.targetRepsMin,
    MIN_TARGET_REPS,
    MAX_TARGET_REPS,
  );
  const targetRepsMax = parseOptionalInt(
    'targetRepsMax',
    body.targetRepsMax,
    MIN_TARGET_REPS,
    MAX_TARGET_REPS,
  );

  if (targetRepsMin !== undefined && targetRepsMax !== undefined && targetRepsMin > targetRepsMax) {
    throw new BadRequestException('targetRepsMin must be <= targetRepsMax');
  }

  return { targetSets, targetRepsMin, targetRepsMax };
}

export interface CreateTemplateExerciseInput extends TemplateExerciseTargets {
  exerciseId: string;
}

export interface CreateTemplateInput {
  name: string;
  description?: string;
  exercises: CreateTemplateExerciseInput[];
}

export function parseCreateTemplateInput(body: unknown): CreateTemplateInput {
  if (typeof body !== 'object' || body === null) {
    throw new BadRequestException('Request body must be an object');
  }
  const { name, description, exercises } = body as Record<string, unknown>;

  if (typeof name !== 'string' || name.trim().length === 0) {
    throw new BadRequestException('name is required');
  }
  if (description !== undefined && description !== null && typeof description !== 'string') {
    throw new BadRequestException('description must be a string');
  }

  let parsedExercises: CreateTemplateExerciseInput[] = [];
  if (exercises !== undefined && exercises !== null) {
    if (!Array.isArray(exercises)) {
      throw new BadRequestException('exercises must be an array');
    }
    parsedExercises = exercises.map((raw, idx) => {
      if (typeof raw !== 'object' || raw === null) {
        throw new BadRequestException(`exercises[${idx}] must be an object`);
      }
      const { exerciseId, ...rest } = raw as Record<string, unknown>;
      if (typeof exerciseId !== 'string' || exerciseId.trim().length === 0) {
        throw new BadRequestException(`exercises[${idx}].exerciseId is required`);
      }
      return { exerciseId, ...parseTargets(rest) };
    });
  }

  return {
    name: name.trim(),
    description: description ?? undefined,
    exercises: parsedExercises,
  };
}

export interface UpdateTemplateInput {
  name?: string;
  description?: string | null;
}

// only name/description — per the spec, structural edits go through the
// dedicated exercises sub-resource
export function parseUpdateTemplateInput(body: unknown): UpdateTemplateInput {
  if (typeof body !== 'object' || body === null) {
    throw new BadRequestException('Request body must be an object');
  }
  const { name, description } = body as Record<string, unknown>;

  const result: UpdateTemplateInput = {};
  if (name !== undefined) {
    if (typeof name !== 'string' || name.trim().length === 0) {
      throw new BadRequestException('name must be a non-empty string');
    }
    result.name = name.trim();
  }
  if (description !== undefined) {
    if (description !== null && typeof description !== 'string') {
      throw new BadRequestException('description must be a string or null');
    }
    result.description = description;
  }
  return result;
}

export function parseAddTemplateExerciseInput(body: unknown): CreateTemplateExerciseInput {
  if (typeof body !== 'object' || body === null) {
    throw new BadRequestException('Request body must be an object');
  }
  const { exerciseId, ...rest } = body as Record<string, unknown>;
  if (typeof exerciseId !== 'string' || exerciseId.trim().length === 0) {
    throw new BadRequestException('exerciseId is required');
  }
  return { exerciseId, ...parseTargets(rest) };
}

export interface UpdateTemplateExerciseInput extends TemplateExerciseTargets {
  order?: number;
}

export function parseUpdateTemplateExerciseInput(body: unknown): UpdateTemplateExerciseInput {
  if (typeof body !== 'object' || body === null) {
    throw new BadRequestException('Request body must be an object');
  }
  const { order, ...rest } = body as Record<string, unknown>;
  const targets = parseTargets(rest);
  const parsedOrder = parseOptionalInt('order', order, 1, 1000);
  return { ...targets, order: parsedOrder };
}
