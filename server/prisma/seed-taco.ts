// Seeds the food library from a local copy of the TACO (Tabela Brasileira de
// Composição de Alimentos, NEPA/UNICAMP) dataset, structured by
// github.com/brolesi/taco from the original public-domain spreadsheet.
// Committed as seed-data/taco_composicao.csv instead of fetched at build
// time, so the seed doesn't depend on network access.
// Idempotent (upsert by [source, externalId]) — safe to re-run, never
// duplicates rows.
// Separate from the main app: run manually via `npm run db:seed:taco`, not
// wired into `prisma migrate reset`'s migrations.seed.
import "dotenv/config";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parse } from "csv-parse/sync";
import { PrismaClient, type Prisma } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

export interface RawTacoRow {
  numero_alimento: string;
  descricao: string;
  energia_kcal: string;
  proteina_g: string;
  lipideos_g: string;
  carboidrato_g: string;
  fibra_g: string;
  sodio_mg: string;
}

// TACO cells are either a number, blank (not analyzed/not applicable), or
// "1e-05" (trace amount below the quantification limit — already a valid
// number, no special-casing needed). Blank means "no data", not zero.
export function parseTacoNumber(raw: string | undefined): number | null {
  if (raw === undefined || raw === "" || raw === "NA") return null;
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
}

// shared shape for both the create and update branches of the upsert — the
// only difference between them is `source`/`externalId`, which never change
// on update
export function buildFoodFields(row: RawTacoRow) {
  return {
    name: row.descricao,
    kcal: parseTacoNumber(row.energia_kcal) ?? 0,
    protein: parseTacoNumber(row.proteina_g) ?? 0,
    carbs: parseTacoNumber(row.carboidrato_g) ?? 0,
    fat: parseTacoNumber(row.lipideos_g) ?? 0,
    fiber: parseTacoNumber(row.fibra_g),
    sodium: parseTacoNumber(row.sodio_mg),
  };
}

type FoodUpsertClient = {
  food: { upsert: (args: Prisma.FoodUpsertArgs) => Promise<unknown> };
};

export async function seedTacoFoods(
  prisma: FoodUpsertClient,
  rows: RawTacoRow[],
): Promise<number> {
  let count = 0;
  for (const row of rows) {
    const externalId = row.numero_alimento;
    const fields = buildFoodFields(row);
    await prisma.food.upsert({
      where: { source_externalId: { source: "TACO", externalId } },
      create: { ...fields, source: "TACO", externalId },
      update: fields,
    });
    count++;
  }
  return count;
}

async function main() {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
  const prisma = new PrismaClient({ adapter });

  const csvPath = join(__dirname, "seed-data", "taco_composicao.csv");
  const csvContent = readFileSync(csvPath, "utf-8");
  const rows = parse(csvContent, {
    columns: true,
    skip_empty_lines: true,
  }) as RawTacoRow[];

  console.log(`[seed-taco] seeding ${rows.length} foods...`);

  const count = await seedTacoFoods(prisma, rows);

  console.log(`[seed-taco] done — ${count} foods upserted`);
  await prisma.$disconnect();
}

// guard so importing this module (e.g. from tests) never triggers a real run
if (require.main === module) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
