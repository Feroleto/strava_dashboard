import { describe, it, expect } from 'vitest';
import type { FoodListItem } from '@/lib/types';
import {
  defaultPortion,
  formatQuantity,
  gramsFromServings,
  hasServing,
  kcalForQuantity,
  servingsFromGrams,
  unitLabel,
} from './quantityFormat';

const egg: FoodListItem = {
  id: 'f1',
  name: 'Ovo, de galinha, inteiro, cozido/10minutos',
  brand: null,
  source: 'TACO',
  imageUrl: null,
  kcal: 146,
  protein: 13.3,
  carbs: 0.6,
  fat: 9.5,
  fiber: null,
  sodium: 140,
  servingLabel: 'unit',
  servingGrams: 50,
};

const rice: FoodListItem = { ...egg, id: 'f2', name: 'Arroz', servingLabel: null, servingGrams: null };

// stand-in for i18next's t(): returns the key plus the count so the plural
// branch is observable without pulling i18n into a pure test
const t = (key: string, options?: Record<string, unknown>) => `${key}#${options?.count}`;

describe('hasServing', () => {
  it('is true only for a positive serving weight', () => {
    expect(hasServing(egg)).toBe(true);
    expect(hasServing(rice)).toBe(false);
    expect(hasServing({ servingLabel: 'unit', servingGrams: 0 })).toBe(false);
  });
});

describe('defaultPortion', () => {
  it('defaults a food with a household measure to exactly one of it', () => {
    expect(defaultPortion(egg)).toEqual({ quantity: 50, enteredAsServing: true });
  });

  it('falls back to the flat 100g portion otherwise', () => {
    expect(defaultPortion(rice)).toEqual({ quantity: 100, enteredAsServing: false });
  });
});

describe('servingsFromGrams / gramsFromServings', () => {
  it('round-trips whole servings', () => {
    expect(servingsFromGrams(100, 50)).toBe(2);
    expect(gramsFromServings(2, 50)).toBe(100);
  });

  it('handles halves', () => {
    expect(gramsFromServings(0.5, 25)).toBe(12.5);
    expect(servingsFromGrams(12.5, 25)).toBe(0.5);
  });

  it('rounds a non-exact division instead of showing float noise', () => {
    expect(servingsFromGrams(73, 50)).toBe(1.46);
    expect(gramsFromServings(1 / 3, 86)).toBe(28.7);
  });

  it('returns 0 servings when the food has no usable serving weight', () => {
    expect(servingsFromGrams(100, 0)).toBe(0);
  });
});

describe('formatQuantity', () => {
  it('renders servings with the grams in parentheses', () => {
    expect(formatQuantity(egg, 100, true, t, 'en-US')).toBe('2 quantity.units.unit#2 (100 g)');
  });

  it('pluralizes through the count passed to t()', () => {
    expect(formatQuantity(egg, 50, true, t, 'en-US')).toBe('1 quantity.units.unit#1 (50 g)');
  });

  it('renders plain grams when the portion was entered in grams', () => {
    expect(formatQuantity(egg, 73, false, t, 'en-US')).toBe('73 g');
  });

  it('renders plain grams for a food with no household measure, even if flagged', () => {
    expect(formatQuantity(rice, 150, true, t, 'en-US')).toBe('150 g');
  });

  // the visible number is localized (0,5) but t() still receives a raw number
  // as `count`, which is what i18next's plural resolver needs
  it('uses the locale number format for display only', () => {
    expect(formatQuantity(egg, 25, true, t, 'pt-BR')).toBe('0,5 quantity.units.unit#0.5 (25 g)');
  });
});

describe('unitLabel', () => {
  it('translates a known slug', () => {
    expect(unitLabel('slice', 3, t)).toBe('quantity.units.slice#3');
  });

  it('falls back to the raw slug for an unknown unit instead of rendering blank', () => {
    expect(unitLabel('handful', 2, t)).toBe('handful');
  });
});

describe('kcalForQuantity', () => {
  it('scales the per-100g value by the portion', () => {
    expect(kcalForQuantity(egg, 50)).toBe(73);
    expect(kcalForQuantity(egg, 100)).toBe(146);
  });
});
