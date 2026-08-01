// Closed vocabulary for Food.servingLabel. A slug — never user-visible prose —
// so the client can translate it with proper pluralization ("1 unidade" /
// "2 unidades"), same convention as the insight keys in the analysis feature.
// Shared by foods.dto.ts (validation), open-food-facts.service.ts (mapping)
// and prisma/seed-taco-servings.ts (the curated TACO overlay).
export const SERVING_UNITS = [
  'unit',
  'slice',
  'serving',
  'tablespoon',
  'teaspoon',
  'cup',
  'scoop',
] as const;

export type ServingUnit = (typeof SERVING_UNITS)[number];

export function isServingUnit(value: unknown): value is ServingUnit {
  return typeof value === 'string' && (SERVING_UNITS as readonly string[]).includes(value);
}
