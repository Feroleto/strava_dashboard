import { describe, it, expect, beforeEach, vi } from 'vitest';
import { OpenFoodFactsService } from 'src/foods/open-food-facts.service';

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
    });
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
