// Leaf shape of what we read from the OFF v2 product endpoint — not the full
// payload (dozens of unused fields), mirror of strava-api.types.ts
export interface OffNutriments {
  'energy-kcal_100g'?: number;
  proteins_100g?: number;
  carbohydrates_100g?: number;
  fat_100g?: number;
  fiber_100g?: number;
  /** grams, not mg — OFF's own convention, differs from TACO's sodio_mg */
  sodium_100g?: number;
}

export interface OffProduct {
  product_name?: string;
  brands?: string;
  image_url?: string;
  nutriments?: OffNutriments;
}

export interface OffProductResponse {
  /** 1 = found, 0 = not found (still HTTP 200) */
  status: number;
  product?: OffProduct;
}
