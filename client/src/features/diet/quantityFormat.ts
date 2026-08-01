import type { FoodListItem } from '@/lib/types';
import { DEFAULT_PORTION_G, SERVING_UNITS, type ServingUnit } from './constants';

/** what gets sent to the API: grams, plus how the user expressed it */
export interface Portion {
  /** always grams */
  quantity: number;
  /** display hint only — never affects the stored macros */
  enteredAsServing: boolean;
}

/** minimal shape needed to format a portion — anything with serving info */
export type ServingSource = Pick<FoodListItem, 'servingLabel' | 'servingGrams'>;

export function hasServing(food: ServingSource): boolean {
  return typeof food.servingGrams === 'number' && food.servingGrams > 0;
}

/**
 * A food with a known household measure defaults to exactly one of it (1 ovo,
 * 1 fatia); everything else falls back to the flat 100g the module used before.
 */
export function defaultPortion(food: ServingSource): Portion {
  return hasServing(food)
    ? { quantity: food.servingGrams as number, enteredAsServing: true }
    : { quantity: DEFAULT_PORTION_G, enteredAsServing: false };
}

/** grams → servings, rounded to halves-friendly precision for the input field */
export function servingsFromGrams(grams: number, servingGrams: number): number {
  if (!(servingGrams > 0)) return 0;
  return roundTo(grams / servingGrams, 2);
}

/** servings → grams, the only direction that ever reaches the API */
export function gramsFromServings(servings: number, servingGrams: number): number {
  return roundTo(servings * servingGrams, 1);
}

export function roundTo(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

/** drops trailing zeros so 1.5 reads "1,5" and 2.0 reads "2" */
export function formatNumber(value: number, locale: string): string {
  return new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(value);
}

function isKnownUnit(slug: string): slug is ServingUnit {
  return (SERVING_UNITS as readonly string[]).includes(slug);
}

/**
 * Translated unit name with pluralization ("1 unidade" / "2 unidades").
 * Falls back to the raw slug if the server ever sends one the client doesn't
 * know — a new unit shows up untranslated instead of blank.
 */
export function unitLabel(
  slug: string,
  count: number,
  t: (key: string, options?: Record<string, unknown>) => string,
): string {
  if (!isKnownUnit(slug)) return slug;
  return t(`quantity.units.${slug}`, { count });
}

/**
 * Row subtitle for a portion: "2 unidades (100 g)" when it was entered in
 * servings, plain "150 g" otherwise.
 */
export function formatQuantity(
  food: ServingSource,
  quantity: number,
  enteredAsServing: boolean,
  t: (key: string, options?: Record<string, unknown>) => string,
  locale: string,
): string {
  const grams = `${formatNumber(roundTo(quantity, 1), locale)} g`;
  if (!enteredAsServing || !hasServing(food) || !food.servingLabel) return grams;

  const servings = servingsFromGrams(quantity, food.servingGrams as number);
  const label = unitLabel(food.servingLabel, servings, t);
  return `${formatNumber(servings, locale)} ${label} (${grams})`;
}

/** kcal for a portion — every macro on Food is per 100g */
export function kcalForQuantity(food: Pick<FoodListItem, 'kcal'>, quantity: number): number {
  return (food.kcal * quantity) / 100;
}
