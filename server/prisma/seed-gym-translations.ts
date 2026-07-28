// Backfills namePt/instructionsPt on already-seeded Exercise rows (source:
// SEED only) from a committed static translation file — not a live
// translation API, same "no network dependency" philosophy as seed-gym.ts
// itself. Update-only via updateMany (never creates a row): translations
// only ever apply to exercises that already went through seed-gym.ts.
// Idempotent and safe to re-run — warns and skips rather than throwing when
// a translation is missing for some id, or when a slug no longer matches
// any existing row, so it also tolerates future additions to the English
// source dataset that haven't been translated yet.
import "dotenv/config";
import { PrismaClient, type Prisma } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import exercisesData from "./seed-data/exercises.json";
import translationsData from "./seed-data/exercises.pt.json";
import { slugify, type RawExercise } from "./seed-gym";

export interface Translation {
  id: string;
  namePt: string;
  instructionsPt: string[];
}

type ExerciseUpdateManyClient = {
  exercise: { updateMany: (args: Prisma.ExerciseUpdateManyArgs) => Promise<{ count: number }> };
};

export async function seedTranslations(
  prisma: ExerciseUpdateManyClient,
  data: RawExercise[],
  translations: Translation[],
): Promise<{ updated: number; skipped: number }> {
  const byId = new Map(translations.map((t) => [t.id, t]));
  let updated = 0;
  let skipped = 0;

  for (const raw of data) {
    const translation = byId.get(raw.id);
    if (!translation) {
      console.warn(`[seed-gym-translations] no pt translation for "${raw.id}" (${raw.name}) — skipping`);
      skipped++;
      continue;
    }

    const slug = slugify(raw.id);
    const result = await prisma.exercise.updateMany({
      where: { slug },
      data: { namePt: translation.namePt, instructionsPt: translation.instructionsPt },
    });

    if (result.count === 0) {
      console.warn(`[seed-gym-translations] no existing exercise for slug "${slug}" — skipping`);
      skipped++;
    } else {
      updated++;
    }
  }

  return { updated, skipped };
}

async function main() {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
  const prisma = new PrismaClient({ adapter });

  const data = exercisesData as RawExercise[];
  const translations = translationsData as Translation[];
  console.log(`[seed-gym-translations] backfilling pt translations for ${data.length} exercises...`);

  const { updated, skipped } = await seedTranslations(prisma, data, translations);

  console.log(`[seed-gym-translations] done — ${updated} updated, ${skipped} skipped`);
  await prisma.$disconnect();
}

// guard so importing this module (e.g. from tests) never triggers a real run
if (require.main === module) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
