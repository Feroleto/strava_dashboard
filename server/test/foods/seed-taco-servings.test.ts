import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  seedTacoServings,
  validateServingRows,
  type RawServingRow,
} from '../../prisma/seed-taco-servings';

const row = (over: Partial<RawServingRow> = {}): RawServingRow => ({
  externalId: '488',
  label: 'unit',
  grams: 50,
  ...over,
});

describe('seed-taco-servings', () => {
  describe('validateServingRows', () => {
    it('accepts a well-formed overlay', () => {
      expect(() => validateServingRows([row(), row({ externalId: '53', grams: 50 })])).not.toThrow();
    });

    it('rejects a label outside the closed vocabulary', () => {
      expect(() => validateServingRows([row({ label: 'punhado' })])).toThrow(/Invalid label/);
    });

    it('rejects a non-positive weight', () => {
      expect(() => validateServingRows([row({ grams: 0 })])).toThrow(/Invalid grams/);
    });

    it('rejects a duplicated externalId (two measures for the same food)', () => {
      expect(() => validateServingRows([row(), row()])).toThrow(/Duplicate externalId/);
    });
  });

  describe('seedTacoServings', () => {
    it('only updates existing TACO rows — never creates a food', async () => {
      const updateMany = vi.fn().mockResolvedValue({ count: 1 });

      const result = await seedTacoServings({ food: { updateMany } }, [row()]);

      expect(updateMany).toHaveBeenCalledWith({
        where: { source: 'TACO', externalId: '488' },
        data: { servingLabel: 'unit', servingGrams: 50 },
      });
      expect(result).toEqual({ updated: 1, missing: [] });
    });

    it('reports externalIds that matched no food instead of failing', async () => {
      const updateMany = vi.fn().mockResolvedValue({ count: 0 });

      const result = await seedTacoServings({ food: { updateMany } }, [row({ externalId: '9999' })]);

      expect(result).toEqual({ updated: 0, missing: ['9999'] });
    });
  });

  // the JSON is hand-authored, so guard the committed file itself — a typo
  // there would otherwise only surface when the seed is run against a database
  it('ships a valid committed overlay', () => {
    const rows = JSON.parse(
      readFileSync(join(__dirname, '../../prisma/seed-data/taco_servings.json'), 'utf-8'),
    ) as RawServingRow[];

    expect(rows.length).toBeGreaterThan(50);
    expect(() => validateServingRows(rows)).not.toThrow();
  });
});
