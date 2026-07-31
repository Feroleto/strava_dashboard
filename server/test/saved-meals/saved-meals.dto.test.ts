import { describe, it, expect } from 'vitest';
import { BadRequestException } from '@nestjs/common';
import {
  parseApplySavedMealInput,
  parseCreateSavedMealInput,
  parseUpdateSavedMealInput,
} from 'src/saved-meals/dto';

describe('parseCreateSavedMealInput', () => {
  it('accepts a valid body with items', () => {
    const result = parseCreateSavedMealInput({
      name: 'Café da manhã de sempre',
      items: [
        { foodId: 'food1', quantity: 100 },
        { foodId: 'food2', quantity: 50 },
      ],
    });

    expect(result.name).toBe('Café da manhã de sempre');
    expect(result.items).toEqual([
      { foodId: 'food1', quantity: 100 },
      { foodId: 'food2', quantity: 50 },
    ]);
  });

  it('defaults items to an empty array when omitted', () => {
    const result = parseCreateSavedMealInput({ name: 'Empty meal' });
    expect(result.items).toEqual([]);
  });

  it('rejects a non-object body', () => {
    expect(() => parseCreateSavedMealInput(null)).toThrow(BadRequestException);
  });

  it('rejects a missing name', () => {
    expect(() => parseCreateSavedMealInput({ items: [] })).toThrow(BadRequestException);
  });

  it('rejects a non-array items value', () => {
    expect(() => parseCreateSavedMealInput({ name: 'x', items: 'nope' })).toThrow(
      BadRequestException,
    );
  });

  it('rejects an item missing foodId', () => {
    expect(() =>
      parseCreateSavedMealInput({ name: 'x', items: [{ quantity: 100 }] }),
    ).toThrow(BadRequestException);
  });

  it('rejects an item with a non-positive quantity', () => {
    expect(() =>
      parseCreateSavedMealInput({ name: 'x', items: [{ foodId: 'food1', quantity: 0 }] }),
    ).toThrow(BadRequestException);
  });
});

describe('parseUpdateSavedMealInput', () => {
  it('leaves items undefined when omitted, only touching name', () => {
    const result = parseUpdateSavedMealInput({ name: 'New name' });
    expect(result).toEqual({ name: 'New name' });
  });

  it('accepts an empty items array (wholesale clear)', () => {
    const result = parseUpdateSavedMealInput({ items: [] });
    expect(result.items).toEqual([]);
  });

  it('rejects an empty-string name', () => {
    expect(() => parseUpdateSavedMealInput({ name: '  ' })).toThrow(BadRequestException);
  });
});

describe('parseApplySavedMealInput', () => {
  const validBody = { mealType: 'BREAKFAST', loggedAt: '2026-07-30T12:00:00.000Z' };

  it('accepts a valid body and parses loggedAt into a Date', () => {
    const result = parseApplySavedMealInput(validBody);
    expect(result.mealType).toBe('BREAKFAST');
    expect(result.loggedAt).toEqual(new Date('2026-07-30T12:00:00.000Z'));
  });

  it('rejects an invalid mealType', () => {
    expect(() => parseApplySavedMealInput({ ...validBody, mealType: 'BRUNCH' })).toThrow(
      BadRequestException,
    );
  });

  it('rejects an unparseable loggedAt', () => {
    expect(() => parseApplySavedMealInput({ ...validBody, loggedAt: 'nope' })).toThrow(
      BadRequestException,
    );
  });
});
