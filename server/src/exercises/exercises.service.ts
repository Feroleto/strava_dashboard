import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma, PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import type { CreateExerciseInput, ExerciseFilters } from './dto';
import { localizedInstructions, localizedName, type Lang } from '../common/lang';

export interface ExerciseListItem {
  id: string;
  name: string;
  slug: string;
  force: string | null;
  level: string | null;
  mechanic: string | null;
  equipment: string | null;
  primaryMuscles: string[];
  secondaryMuscles: string[];
  source: string;
}

export interface ExerciseDetail extends ExerciseListItem {
  instructions: string[];
  imageUrls: string[];
  createdByUserId: string | null;
}

export interface LastPerformanceSet {
  id: string;
  setNumber: number;
  weightKg: number | null;
  reps: number | null;
  rpe: number | null;
  setType: string;
}

export interface LastPerformance {
  workoutId: string;
  startedAt: Date;
  sets: LastPerformanceSet[];
}

export interface ExercisePersonalRecord {
  weightKg: number;
  reps: number | null;
  workoutId: string;
  startedAt: Date;
  templateName: string | null;
}

@Injectable()
export class ExercisesService {
  private readonly prisma: PrismaClient;

  constructor(private readonly config: ConfigService) {
    const adapter = new PrismaPg({
      connectionString: this.config.get<string>('DATABASE_URL'),
    });
    this.prisma = new PrismaClient({ adapter });
  }

  // seed exercises are global reference data (visible to everyone); custom
  // exercises are scoped to their creator, same data-isolation principle as
  // every other userId-owned entity in the app
  private visibilityWhere(userId: string): Prisma.ExerciseWhereInput {
    return {
      OR: [{ source: 'SEED' }, { source: 'USER', createdByUserId: userId }],
    };
  }

  async list(
    userId: string,
    page: number,
    limit: number,
    filters: ExerciseFilters,
    lang: Lang,
  ): Promise<{ items: ExerciseListItem[]; total: number; page: number; limit: number }> {
    const where: Prisma.ExerciseWhereInput = {
      AND: [
        this.visibilityWhere(userId),
        filters.search
          ? {
              OR: [
                { name: { contains: filters.search, mode: 'insensitive' } },
                { namePt: { contains: filters.search, mode: 'insensitive' } },
              ],
            }
          : {},
        filters.muscle ? { primaryMuscles: { has: filters.muscle } } : {},
        filters.muscles && filters.muscles.length > 0
          ? { primaryMuscles: { hasSome: filters.muscles } }
          : {},
        filters.equipment ? { equipment: filters.equipment } : {},
      ],
    };

    const skip = (page - 1) * limit;
    const [rows, total] = await Promise.all([
      this.prisma.exercise.findMany({
        where,
        orderBy: { name: 'asc' },
        skip,
        take: limit,
        select: {
          id: true,
          name: true,
          namePt: true,
          slug: true,
          force: true,
          level: true,
          mechanic: true,
          equipment: true,
          primaryMuscles: true,
          secondaryMuscles: true,
          source: true,
        },
      }),
      this.prisma.exercise.count({ where }),
    ]);

    const items = rows.map(({ namePt, ...rest }) => ({
      ...rest,
      name: localizedName(rest.name, namePt, lang),
    }));

    return { items, total, page, limit };
  }

  async findById(userId: string, id: string, lang: Lang): Promise<ExerciseDetail | null> {
    const row = await this.prisma.exercise.findFirst({
      where: { id, ...this.visibilityWhere(userId) },
      select: {
        id: true,
        name: true,
        namePt: true,
        slug: true,
        force: true,
        level: true,
        mechanic: true,
        equipment: true,
        primaryMuscles: true,
        secondaryMuscles: true,
        instructions: true,
        instructionsPt: true,
        imageUrls: true,
        source: true,
        createdByUserId: true,
      },
    });
    if (!row) return null;

    const { namePt, instructionsPt, ...rest } = row;
    return {
      ...rest,
      name: localizedName(rest.name, namePt, lang),
      instructions: localizedInstructions(rest.instructions, instructionsPt, lang),
    };
  }

  async create(userId: string, input: CreateExerciseInput): Promise<ExerciseDetail> {
    const slug = await this.uniqueSlug(input.name);

    return this.prisma.exercise.create({
      data: {
        name: input.name,
        slug,
        force: input.force,
        level: input.level,
        mechanic: input.mechanic,
        equipment: input.equipment,
        primaryMuscles: input.primaryMuscles,
        secondaryMuscles: input.secondaryMuscles,
        instructions: input.instructions,
        imageUrls: input.imageUrls,
        source: 'USER',
        createdByUserId: userId,
      },
      select: {
        id: true,
        name: true,
        slug: true,
        force: true,
        level: true,
        mechanic: true,
        equipment: true,
        primaryMuscles: true,
        secondaryMuscles: true,
        instructions: true,
        imageUrls: true,
        source: true,
        createdByUserId: true,
      },
    });
  }

  private async uniqueSlug(name: string): Promise<string> {
    const base = name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');

    let slug = base;
    let suffix = 1;
    // custom exercise names collide rarely; a short retry loop beats a
    // separate reservation table for this volume
    while (await this.prisma.exercise.findUnique({ where: { slug }, select: { id: true } })) {
      suffix += 1;
      slug = `${base}-${suffix}`;
    }
    return slug;
  }

  async lastPerformance(userId: string, exerciseId: string): Promise<LastPerformance | null> {
    const workoutExercise = await this.prisma.workoutExercise.findFirst({
      where: { exerciseId, workout: { userId, finishedAt: { not: null } } },
      orderBy: { workout: { startedAt: 'desc' } },
      select: {
        workoutId: true,
        workout: { select: { startedAt: true } },
        sets: {
          orderBy: { setNumber: 'asc' },
          select: { id: true, setNumber: true, weightKg: true, reps: true, rpe: true, setType: true },
        },
      },
    });

    if (!workoutExercise) return null;

    return {
      workoutId: workoutExercise.workoutId,
      startedAt: workoutExercise.workout.startedAt,
      sets: workoutExercise.sets.map((s) => ({
        id: s.id,
        setNumber: s.setNumber,
        weightKg: s.weightKg ? Number(s.weightKg) : null,
        reps: s.reps,
        rpe: s.rpe ? Number(s.rpe) : null,
        setType: s.setType,
      })),
    };
  }

  // heaviest set ever logged for this exercise, across every finished
  // workout — unlike lastPerformance() above (most recent session only),
  // this is a genuine PR. Ties on weight broken by more reps, then most
  // recent; scoped to workout.userId so it's inherently safe to call with
  // any exerciseId (an exercise the caller can't see, or one they've never
  // logged, both just resolve to null — no cross-user data can leak, since
  // only the requesting user's own sets are ever matched)
  async personalRecord(userId: string, exerciseId: string): Promise<ExercisePersonalRecord | null> {
    const set = await this.prisma.workoutSet.findFirst({
      where: {
        weightKg: { not: null },
        workoutExercise: {
          exerciseId,
          workout: { userId, finishedAt: { not: null } },
        },
      },
      orderBy: [{ weightKg: 'desc' }, { reps: 'desc' }, { completedAt: 'desc' }],
      select: {
        weightKg: true,
        reps: true,
        workoutExercise: {
          select: {
            workout: {
              select: { id: true, startedAt: true, template: { select: { name: true } } },
            },
          },
        },
      },
    });
    if (!set || set.weightKg == null) return null;

    return {
      weightKg: Number(set.weightKg),
      reps: set.reps,
      workoutId: set.workoutExercise.workout.id,
      startedAt: set.workoutExercise.workout.startedAt,
      templateName: set.workoutExercise.workout.template?.name ?? null,
    };
  }
}
