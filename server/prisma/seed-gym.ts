// Seeds the exercise library from a local copy of yuhonas/free-exercise-db
// (public domain, Unlicense). Committed as seed-data/exercises.json instead
// of fetched at build time, so the seed doesn't depend on network access.
// Idempotent (upsert by slug) — safe to re-run, never duplicates rows.
// Separate from the main app: run manually via `npm run db:seed:gym`, not
// wired into `prisma migrate reset`'s migrations.seed.
import "dotenv/config";
import {
  PrismaClient,
  ExerciseForce,
  ExerciseLevel,
  ExerciseMechanic,
  Equipment,
  MuscleGroup,
  type Prisma,
} from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import exercisesData from "./seed-data/exercises.json";

export interface RawExercise {
  id: string;
  name: string;
  force?: string | null;
  level?: string | null;
  mechanic?: string | null;
  equipment?: string | null;
  primaryMuscles: string[];
  secondaryMuscles: string[];
  instructions: string[];
  images: string[];
  category: string;
}

const IMAGE_BASE_URL =
  "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/";

const FORCE_MAP: Record<string, ExerciseForce> = {
  push: ExerciseForce.PUSH,
  pull: ExerciseForce.PULL,
  static: ExerciseForce.STATIC,
};

const LEVEL_MAP: Record<string, ExerciseLevel> = {
  beginner: ExerciseLevel.BEGINNER,
  intermediate: ExerciseLevel.INTERMEDIATE,
  expert: ExerciseLevel.EXPERT,
};

const MECHANIC_MAP: Record<string, ExerciseMechanic> = {
  compound: ExerciseMechanic.COMPOUND,
  isolation: ExerciseMechanic.ISOLATION,
};

const EQUIPMENT_MAP: Record<string, Equipment> = {
  barbell: Equipment.BARBELL,
  dumbbell: Equipment.DUMBBELL,
  machine: Equipment.MACHINE,
  cable: Equipment.CABLE,
  "body only": Equipment.BODY_ONLY,
  kettlebells: Equipment.KETTLEBELLS,
  bands: Equipment.BANDS,
  "medicine ball": Equipment.MEDICINE_BALL,
  "exercise ball": Equipment.EXERCISE_BALL,
  "foam roll": Equipment.FOAM_ROLL,
  "e-z curl bar": Equipment.EZ_CURL_BAR,
  other: Equipment.OTHER,
};

// "middle back" has no 1:1 enum value — closest fit is BACK
const MUSCLE_MAP: Record<string, MuscleGroup> = {
  chest: MuscleGroup.CHEST,
  back: MuscleGroup.BACK,
  "middle back": MuscleGroup.BACK,
  lats: MuscleGroup.LATS,
  traps: MuscleGroup.TRAPS,
  shoulders: MuscleGroup.SHOULDERS,
  biceps: MuscleGroup.BICEPS,
  triceps: MuscleGroup.TRICEPS,
  forearms: MuscleGroup.FOREARMS,
  abdominals: MuscleGroup.ABDOMINALS,
  quadriceps: MuscleGroup.QUADRICEPS,
  hamstrings: MuscleGroup.HAMSTRINGS,
  glutes: MuscleGroup.GLUTES,
  calves: MuscleGroup.CALVES,
  adductors: MuscleGroup.ADDUCTORS,
  abductors: MuscleGroup.ABDUCTORS,
  "lower back": MuscleGroup.LOWER_BACK,
  neck: MuscleGroup.NECK,
  cardio: MuscleGroup.CARDIO,
  "full body": MuscleGroup.FULL_BODY,
};

export function slugify(id: string): string {
  return id
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function mapEnum<T extends string>(
  map: Record<string, T>,
  raw: string | null | undefined,
  label: string,
  exerciseName: string,
): T | undefined {
  if (!raw) return undefined;
  const key = raw.toLowerCase();
  const mapped = map[key];
  if (!mapped) {
    console.warn(
      `[seed-gym] no ${label} mapping for "${raw}" (exercise "${exerciseName}") — leaving unset`,
    );
    return undefined;
  }
  return mapped;
}

export function mapMuscles(raw: string[], exerciseName: string): MuscleGroup[] {
  return raw
    .map((m) => mapEnum(MUSCLE_MAP, m, "muscle", exerciseName))
    .filter((m): m is MuscleGroup => m !== undefined);
}

// shared shape for both the create and update branches of the upsert — the
// only difference between them is `source`, which never changes on update
export function buildExerciseFields(raw: RawExercise) {
  return {
    name: raw.name,
    force: mapEnum(FORCE_MAP, raw.force, "force", raw.name),
    level: mapEnum(LEVEL_MAP, raw.level, "level", raw.name),
    mechanic: mapEnum(MECHANIC_MAP, raw.mechanic, "mechanic", raw.name),
    equipment: mapEnum(EQUIPMENT_MAP, raw.equipment, "equipment", raw.name),
    primaryMuscles: mapMuscles(raw.primaryMuscles, raw.name),
    secondaryMuscles: mapMuscles(raw.secondaryMuscles, raw.name),
    instructions: raw.instructions,
    imageUrls: raw.images.map((img) => `${IMAGE_BASE_URL}${img}`),
  };
}

type ExerciseUpsertClient = {
  exercise: { upsert: (args: Prisma.ExerciseUpsertArgs) => Promise<unknown> };
};

export async function seedExercises(
  prisma: ExerciseUpsertClient,
  data: RawExercise[],
): Promise<number> {
  let count = 0;
  for (const raw of data) {
    const slug = slugify(raw.id);
    const fields = buildExerciseFields(raw);
    await prisma.exercise.upsert({
      where: { slug },
      create: { ...fields, slug, source: "SEED" },
      update: fields,
    });
    count++;
  }
  return count;
}

async function main() {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
  const prisma = new PrismaClient({ adapter });

  const data = exercisesData as RawExercise[];
  console.log(`[seed-gym] seeding ${data.length} exercises...`);

  const count = await seedExercises(prisma, data);

  console.log(`[seed-gym] done — ${count} exercises upserted`);
  await prisma.$disconnect();
}

// guard so importing this module (e.g. from tests) never triggers a real run
if (require.main === module) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
