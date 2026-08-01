import { describe, it, expect, beforeEach, vi } from 'vitest';
import { OpenFoodFactsService, parseOffServingGrams } from 'src/foods/open-food-facts.service';

function offResponse(body: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  };
}

describe('OpenFoodFactsService', () => {
  let service: OpenFoodFactsService;
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    service = new OpenFoodFactsService();
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });

  it('sends a descriptive User-Agent header, as required by the Open Food Facts API', async () => {
    fetchMock.mockResolvedValueOnce(offResponse({ status: 0 }));

    await service.lookupByBarcode('0000000000000');

    const [, init] = fetchMock.mock.calls[0];
    expect(init.headers['User-Agent']).toContain('sotreina');
  });

  it('returns null when the product is not found (status 0, still HTTP 200)', async () => {
    fetchMock.mockResolvedValueOnce(offResponse({ status: 0 }));

    const result = await service.lookupByBarcode('0000000000000');

    expect(result).toBeNull();
  });

  it('maps a found product, normalizing sodium from grams to mg', async () => {
    fetchMock.mockResolvedValueOnce(
      offResponse({
        status: 1,
        product: {
          product_name: 'Nutella',
          brands: 'Nutella, Ferrero',
          image_url: 'https://images.openfoodfacts.org/nutella.jpg',
          nutriments: {
            'energy-kcal_100g': 539,
            proteins_100g: 6.3,
            carbohydrates_100g: 57.5,
            fat_100g: 30.9,
            sodium_100g: 0.0428,
          },
        },
      }),
    );

    const result = await service.lookupByBarcode('3017620422003');

    expect(result).toEqual({
      name: 'Nutella',
      brand: 'Nutella, Ferrero',
      imageUrl: 'https://images.openfoodfacts.org/nutella.jpg',
      kcal: 539,
      protein: 6.3,
      carbs: 57.5,
      fat: 30.9,
      fiber: null,
      sodium: 42.8,
      servingGrams: null,
    });
  });

  it('reads serving_quantity into servingGrams when the product declares one', async () => {
    fetchMock.mockResolvedValueOnce(
      offResponse({
        status: 1,
        product: {
          product_name: 'Biscoito',
          serving_size: '30 g (2 biscoitos)',
          serving_quantity: 30,
          nutriments: { 'energy-kcal_100g': 470 },
        },
      }),
    );

    const result = await service.lookupByBarcode('7891000000000');

    expect(result?.servingGrams).toBe(30);
  });

  it('accepts serving_quantity typed as a string (OFF is inconsistent about it)', async () => {
    fetchMock.mockResolvedValueOnce(
      offResponse({
        status: 1,
        product: {
          product_name: 'Iogurte',
          serving_quantity: '170',
          nutriments: { 'energy-kcal_100g': 60 },
        },
      }),
    );

    const result = await service.lookupByBarcode('7891000000001');

    expect(result?.servingGrams).toBe(170);
  });

  describe('parseOffServingGrams', () => {
    it('keeps a positive number', () => {
      expect(parseOffServingGrams(30)).toBe(30);
    });

    it('parses a numeric string', () => {
      expect(parseOffServingGrams('25.5')).toBe(25.5);
    });

    it.each([undefined, '', 0, -5, 'não informado'])(
      'degrades %p to null (no usable serving info)',
      (raw) => {
        expect(parseOffServingGrams(raw as number | string | undefined)).toBeNull();
      },
    );
  });

  it('returns null when the product has no energy-kcal_100g (Food.kcal is required)', async () => {
    fetchMock.mockResolvedValueOnce(
      offResponse({
        status: 1,
        product: { product_name: 'Mystery item', nutriments: {} },
      }),
    );

    const result = await service.lookupByBarcode('1234567890123');

    expect(result).toBeNull();
  });

  it('returns null on a network/HTTP failure instead of throwing', async () => {
    fetchMock.mockRejectedValueOnce(new Error('network down'));

    const result = await service.lookupByBarcode('1234567890123');

    expect(result).toBeNull();
  });

  it('returns null on a non-ok HTTP response', async () => {
    fetchMock.mockResolvedValueOnce(offResponse({}, 500));

    const result = await service.lookupByBarcode('1234567890123');

    expect(result).toBeNull();
  });
});
