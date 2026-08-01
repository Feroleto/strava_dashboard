// Backfills household measures ("1 unidade", "1 fatia", "1 colher de sopa")
// onto TACO foods. The TACO dataset itself has no per-unit column — every row
// is strictly per-100g composition — so this overlay is authored data, curated
// in seed-data/taco_servings.json and committed alongside the CSV.
//
// Same shape as seed-gym-translations.ts: a separate backfill, run manually via
// `npm run db:seed:taco:servings`, that only ever *updates* rows matched by
// [source: TACO, externalId] and never creates one. Idempotent. A food with no
// entry here simply stays grams-only — a safe (if silent) failure mode.
import "dotenv/config";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { PrismaClient, type Prisma } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { SERVING_UNITS, isServingUnit } from "../src/foods/serving-units";

export interface RawServingRow {
  /** numero_alimento in taco_composicao.csv */
  externalId: string;
  label: string;
  grams: number;
  /** human note on what the measure refers to — documentation only, not stored */
  note?: string;
}

// The JSON is hand-written, so it's validated rather than trusted: a typo in a
// label or a zero/negative weight would otherwise reach the database silently.
export function validateServingRows(rows: RawServingRow[]): void {
  const seen = new Set<string>();
  for (const row of rows) {
    if (!row.externalId || typeof row.externalId !== "string") {
      throw new Error(`Invalid externalId: ${JSON.stringify(row)}`);
    }
    if (seen.has(row.externalId)) {
      throw new Error(`Duplicate externalId ${row.externalId}`);
    }
    seen.add(row.externalId);
    if (!isServingUnit(row.label)) {
      throw new Error(
        `Invalid label "${row.label}" for ${row.externalId}. Expected one of: ${SERVING_UNITS.join(", ")}`,
      );
    }
    if (typeof row.grams !== "number" || !Number.isFinite(row.grams) || row.grams <= 0) {
      throw new Error(`Invalid grams for ${row.externalId}: ${row.grams}`);
    }
  }
}

type FoodUpdateManyClient = {
  food: {
    updateMany: (args: Prisma.FoodUpdateManyArgs) => Promise<{ count: number }>;
  };
};

export async function seedTacoServings(
  prisma: FoodUpdateManyClient,
  rows: RawServingRow[],
): Promise<{ updated: number; missing: string[] }> {
  validateServingRows(rows);

  let updated = 0;
  const missing: string[] = [];

  for (const row of rows) {
    const result = await prisma.food.updateMany({
      where: { source: "TACO", externalId: row.externalId },
      data: { servingLabel: row.label, servingGrams: row.grams },
    });
    if (result.count === 0) {
      missing.push(row.externalId);
    } else {
      updated += result.count;
    }
  }

  return { updated, missing };
}

async function main() {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
  const prisma = new PrismaClient({ adapter });

  const jsonPath = join(__dirname, "seed-data", "taco_servings.json");
  const rows = JSON.parse(readFileSync(jsonPath, "utf-8")) as RawServingRow[];

  console.log(`[seed-taco-servings] applying ${rows.length} household measures...`);

  const { updated, missing } = await seedTacoServings(prisma, rows);

  console.log(`[seed-taco-servings] done — ${updated} foods updated`);
  if (missing.length > 0) {
    // not fatal: the TACO seed may simply not have run yet, or an externalId
    // was mistyped — either way those foods stay grams-only
    console.warn(
      `[seed-taco-servings] ${missing.length} externalId(s) matched no TACO food: ${missing.join(", ")}`,
    );
  }
  await prisma.$disconnect();
}

// guard so importing this module (e.g. from tests) never triggers a real run
if (require.main === module) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
