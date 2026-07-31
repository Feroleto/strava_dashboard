import { describe, it, expect } from 'vitest';
import { BadRequestException } from '@nestjs/common';
import { parseCreateCustomFoodInput, parseSearchQuery } from 'src/foods/foods.dto';

describe('parseSearchQuery', () => {
  it('trims and returns a valid query', () => {
    expect(parseSearchQuery('  arroz  ')).toBe('arroz');
  });

  it('rejects a missing or blank query', () => {
    expect(() => parseSearchQuery(undefined)).toThrow(BadRequestException);
    expect(() => parseSearchQuery('   ')).toThrow(BadRequestException);
  });
});

describe('parseCreateCustomFoodInput', () => {
  const validBody = {
    name: 'Homemade granola',
    kcal: 450,
    protein: 10,
    carbs: 60,
    fat: 15,
  };

  it('accepts a valid body without optional fields', () => {
    const result = parseCreateCustomFoodInput(validBody);

    expect(result).toEqual({
      name: 'Homemade granola',
      kcal: 450,
      protein: 10,
      carbs: 60,
      fat: 15,
      fiber: undefined,
      sodium: undefined,
      externalId: undefined,
    });
  });

  it('accepts optional fiber/sodium/externalId when provided', () => {
    const result = parseCreateCustomFoodInput({
      ...validBody,
      fiber: 5,
      sodium: 120,
      externalId: '7891234567890',
    });

    expect(result.fiber).toBe(5);
    expect(result.sodium).toBe(120);
    expect(result.externalId).toBe('7891234567890');
  });

  it('rejects a non-object body', () => {
    expect(() => parseCreateCustomFoodInput(null)).toThrow(BadRequestException);
  });

  it('rejects a missing/blank name', () => {
    expect(() => parseCreateCustomFoodInput({ ...validBody, name: '' })).toThrow(
      BadRequestException,
    );
  });

  it('rejects a negative macro value', () => {
    expect(() => parseCreateCustomFoodInput({ ...validBody, kcal: -1 })).toThrow(
      BadRequestException,
    );
  });

  it('rejects a non-numeric macro value', () => {
    expect(() => parseCreateCustomFoodInput({ ...validBody, protein: 'ten' })).toThrow(
      BadRequestException,
    );
  });
});
