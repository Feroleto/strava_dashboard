import { Injectable, Logger } from '@nestjs/common';
import type { OffProductResponse } from './open-food-facts.types';

const BASE_URL = 'https://world.openfoodfacts.org/api/v2/product';
// OFF's docs require a descriptive User-Agent identifying the app + contact
const USER_AGENT = 'sotreina - fitness tracker - contato@sotreina.com';

export interface OffFoodResult {
  name: string;
  brand: string | null;
  imageUrl: string | null;
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number | null;
  sodium: number | null;
  /** grams in one serving as printed on the package, null when OFF has none */
  servingGrams: number | null;
}

// OFF types serving_quantity inconsistently (number on some products, string
// on others) and occasionally reports 0 for products it couldn't parse —
// anything not strictly positive degrades to "no serving info"
export function parseOffServingGrams(raw: number | string | undefined): number | null {
  if (raw === undefined || raw === null || raw === '') return null;
  const grams = typeof raw === 'number' ? raw : Number(raw);
  return Number.isFinite(grams) && grams > 0 ? grams : null;
}

@Injectable()
export class OpenFoodFactsService {
  private readonly logger = new Logger(OpenFoodFactsService.name);

  // best-effort: any failure (network, malformed payload, missing kcal)
  // degrades to null so the caller falls back to "cadastre manualmente" —
  // same pattern as StravaSyncService's gear/hr-zone lookups. This is a
  // direct user-facing lookup though, so the caller (FoodsService) is the
  // one that turns a null result into a 404, not this service.
  async lookupByBarcode(barcode: string): Promise<OffFoodResult | null> {
    try {
      const res = await fetch(`${BASE_URL}/${encodeURIComponent(barcode)}.json`, {
        headers: { 'User-Agent': USER_AGENT },
      });
      if (!res.ok) return null;

      const body = (await res.json()) as OffProductResponse;
      if (body.status !== 1 || !body.product) return null;

      const n = body.product.nutriments ?? {};
      const kcal = n['energy-kcal_100g'];
      // kcal is required on Food — a product without it can't be stored
      if (typeof kcal !== 'number') return null;

      return {
        name: body.product.product_name?.trim() || barcode,
        brand: body.product.brands?.trim() || null,
        imageUrl: body.product.image_url || null,
        kcal,
        protein: n.proteins_100g ?? 0,
        carbs: n.carbohydrates_100g ?? 0,
        fat: n.fat_100g ?? 0,
        fiber: n.fiber_100g ?? null,
        // OFF reports sodium in grams; the rest of the app (TACO) uses mg
        sodium: typeof n.sodium_100g === 'number' ? n.sodium_100g * 1000 : null,
        servingGrams: parseOffServingGrams(body.product.serving_quantity),
      };
    } catch (err) {
      this.logger.warn(`Open Food Facts lookup failed for barcode ${barcode}: ${err}`);
      return null;
    }
  }
}
