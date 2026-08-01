import type { MealType } from '@/lib/types';

// fixed display order for the day's 5 meal slots — Café da manhã, Almoço,
// Lanche da tarde, Jantar, Ceia
export const MEAL_TYPES: MealType[] = ['BREAKFAST', 'LUNCH', 'SNACK', 'DINNER', 'SUPPER'];

// no --protein/--carbs/--fat tokens exist in index.css — these are the
// literal fallback hex values from the design spec
export const MACRO_COLORS = {
  protein: '#C9634B',
  carbs: '#D9A23D',
  fat: '#7C6FC4',
} as const;

// fallback portion for foods with no known household measure
export const DEFAULT_PORTION_G = 100;

// mirror of SERVING_UNITS in server/src/foods/serving-units.ts — the server
// sends a slug, the label is resolved here through i18n (diet:quantity.units.*)
// with proper pluralization. An unknown slug falls back to the slug itself
// rather than breaking the row.
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

export function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}
