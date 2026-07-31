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

export function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}
