import { describe, it, expect } from 'vitest';
import { BadRequestException } from '@nestjs/common';
import {
  parseCreateMealInput,
  parseReorderMealsInput,
  parseUpdateMealInput,
} from 'src/meals/dto';

describe('parseCreateMealInput', () => {
  it('accepts each name in the vocabulary', () => {
    for (const type of ['BREAKFAST', 'LUNCH', 'SNACK', 'DINNER', 'SUPPER']) {
      expect(parseCreateMealInput({ type })).toEqual({ type });
    }
  });

  it('rejects a name outside the vocabulary', () => {
    expect(() => parseCreateMealInput({ type: 'BRUNCH' })).toThrow(BadRequestException);
    expect(() => parseCreateMealInput({ type: undefined })).toThrow(BadRequestException);
  });

  it('rejects a non-object body', () => {
    expect(() => parseCreateMealInput(null)).toThrow(BadRequestException);
  });
});

describe('parseUpdateMealInput', () => {
  it('accepts a valid type', () => {
    expect(parseUpdateMealInput({ type: 'DINNER' })).toEqual({ type: 'DINNER' });
  });

  // renaming is the only thing PATCH does — order goes through PUT /meals/order
  it('ignores order even when the client sends it', () => {
    expect(parseUpdateMealInput({ type: 'DINNER', order: 99 })).toEqual({ type: 'DINNER' });
  });

  it('rejects a name outside the vocabulary', () => {
    expect(() => parseUpdateMealInput({ type: 'TEATIME' })).toThrow(BadRequestException);
  });
});

describe('parseReorderMealsInput', () => {
  it('accepts a list of ids and trims them', () => {
    expect(parseReorderMealsInput({ ids: ['a', ' b '] })).toEqual({ ids: ['a', 'b'] });
  });

  it('rejects a non-array or empty ids', () => {
    expect(() => parseReorderMealsInput({ ids: 'a' })).toThrow(BadRequestException);
    expect(() => parseReorderMealsInput({ ids: [] })).toThrow(BadRequestException);
    expect(() => parseReorderMealsInput({})).toThrow(BadRequestException);
  });

  it('rejects non-string or blank entries', () => {
    expect(() => parseReorderMealsInput({ ids: ['a', 3] })).toThrow(BadRequestException);
    expect(() => parseReorderMealsInput({ ids: ['a', '  '] })).toThrow(BadRequestException);
  });

  // a duplicate would renumber one meal twice and leave another untouched
  it('rejects duplicate ids', () => {
    expect(() => parseReorderMealsInput({ ids: ['a', 'b', 'a'] })).toThrow(BadRequestException);
  });
});
