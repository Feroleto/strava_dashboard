import { describe, it, expect } from 'vitest';
import { BadRequestException } from '@nestjs/common';
import { parsePagination } from 'src/activities/pagination';

describe('parsePagination', () => {
  it('falls back to page 1 / limit 20 when params are absent', () => {
    expect(parsePagination(undefined, undefined)).toEqual({ page: 1, limit: 20 });
  });

  it('parses valid values', () => {
    expect(parsePagination('3', '50')).toEqual({ page: 3, limit: 50 });
    expect(parsePagination('1', '1000')).toEqual({ page: 1, limit: 1000 });
  });

  it('rejects non-numeric, negative, zero, fractional and oversized values', () => {
    const invalid: Array<[string | undefined, string | undefined]> = [
      ['abc', undefined],
      [undefined, 'abc'],
      ['-5', undefined],
      ['0', undefined],
      ['1.5', undefined],
      [undefined, '0'],
      [undefined, '-1'],
      [undefined, '1001'],
      [undefined, '99999999'],
      ['1000001', undefined],
    ];

    for (const [page, limit] of invalid) {
      expect(() => parsePagination(page, limit)).toThrow(BadRequestException);
    }
  });
});
