import { describe, it, expect } from 'vitest';
import { BadRequestException } from '@nestjs/common';
import {
  parseCreateFoodLogInput,
  parseDateQuery,
  parseDaysQuery,
} from 'src/food-logs/food-logs.dto';

describe('parseCreateFoodLogInput', () => {
  const validBody = {
    foodId: 'food1',
    quantity: 150,
    mealType: 'LUNCH',
    loggedAt: '2026-07-29T12:00:00.000Z',
  };

  it('accepts a valid body and parses loggedAt into a Date', () => {
    const result = parseCreateFoodLogInput(validBody);

    expect(result.foodId).toBe('food1');
    expect(result.quantity).toBe(150);
    expect(result.mealType).toBe('LUNCH');
    expect(result.loggedAt).toEqual(new Date('2026-07-29T12:00:00.000Z'));
  });

  it('rejects a non-object body', () => {
    expect(() => parseCreateFoodLogInput(null)).toThrow(BadRequestException);
  });

  it('rejects a non-positive quantity', () => {
    expect(() => parseCreateFoodLogInput({ ...validBody, quantity: 0 })).toThrow(
      BadRequestException,
    );
  });

  it('rejects an invalid mealType', () => {
    expect(() => parseCreateFoodLogInput({ ...validBody, mealType: 'BRUNCH' })).toThrow(
      BadRequestException,
    );
  });

  it('rejects an unparseable loggedAt', () => {
    expect(() => parseCreateFoodLogInput({ ...validBody, loggedAt: 'not-a-date' })).toThrow(
      BadRequestException,
    );
  });
});

describe('parseDateQuery', () => {
  it('accepts a well-formed YYYY-MM-DD date', () => {
    expect(parseDateQuery('2026-07-29')).toBe('2026-07-29');
  });

  it('rejects a missing or malformed date', () => {
    expect(() => parseDateQuery(undefined)).toThrow(BadRequestException);
    expect(() => parseDateQuery('07/29/2026')).toThrow(BadRequestException);
    expect(() => parseDateQuery('2026-7-29')).toThrow(BadRequestException);
  });
});

describe('parseDaysQuery', () => {
  it('accepts 7 and 14', () => {
    expect(parseDaysQuery('7')).toBe(7);
    expect(parseDaysQuery('14')).toBe(14);
  });

  it('rejects anything else', () => {
    expect(() => parseDaysQuery(undefined)).toThrow(BadRequestException);
    expect(() => parseDaysQuery('30')).toThrow(BadRequestException);
    expect(() => parseDaysQuery('abc')).toThrow(BadRequestException);
  });
});
